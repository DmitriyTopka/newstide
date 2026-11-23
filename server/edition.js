// Edition Printer: one fresh edition per coin and horizon, shared by everyone who asks for
// 30 minutes, under one daily spending limit. The public site and the Telegram bot both
// print through here, so the limit and the cache are never doubled.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collect, horizonOf } from './collect.js';
import { check } from './check.js';
import { recordVerdict } from './journal.js';
import { yahoo } from './market.js';
import { nextEarnings } from './earnings.js';

export const MODEL = process.env.MODEL || 'claude-haiku-5-5';
export const EDITION_TTL_MS = 30 * 60 * 1000;
export const DAILY_LIMIT_USD = Number(process.env.DAILY_LIMIT_USD || 0.5);
export const RESERVE_USD = 0.002; // set aside before each call so parallel requests cannot pass the limit
export const spend = { day: '', usd: 0 };
// Stocks have their own daily budget, so a busy stock page can never starve the crypto editions (and the reverse).
export const STOCK_LIMIT_USD = Number(process.env.STOCK_LIMIT_USD || 0.3);
export const stockSpend = { day: '', usd: 0 };
// News translations get their own small daily sub-budget, so they can never use up what editions need.
export const TRANSLATE_LIMIT_USD = Number(process.env.TRANSLATE_LIMIT_USD || 0.1);
const transSpend = { day: '', usd: 0 };

const editions = new Map();
const inFlight = new Map(); // one print run per coin and horizon at a time
const prices = JSON.parse(await readFile(path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'config/prices.json'), 'utf8'));

// The AI client is loaded only when it is needed, so the demo runs without any key.
const realDeps = {
  analyze: async (...args) => (await import('./analyst.js')).analyze(...args),
  translate: async (...args) => (await import('./translate.js')).translate(...args)
};

export function costOf(usage, model) {
  const p = prices[model] ?? prices[MODEL];
  if (!p || !usage) return 0;
  const input = (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
  return (input * p.input + (usage.output_tokens ?? 0) * p.output) / 1e6;
}

export function resetSpendDay() {
  const today = new Date().toISOString().slice(0, 10);
  if (spend.day !== today) { spend.day = today; spend.usd = 0; }
  if (stockSpend.day !== today) { stockSpend.day = today; stockSpend.usd = 0; }
}

// Is the US stock market open now? Mon-Fri 09:30-16:00 New York time. Holidays are not known, so this is approximate.
export function usMarketOpen(date = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date).map(x => [x.type, x.value]));
  const minutes = Number(p.hour) * 60 + Number(p.minute);
  return !['Sat', 'Sun'].includes(p.weekday) && minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}

const fail = (reason, status) => Object.assign(new Error(reason), { reason, status });

// Returns the edition data, or throws an error with reason "limit", "few" or "print".
export async function getEdition(coin, timeframe, { root, marketFeeds, deps = {}, now = () => Date.now() }) {
  const { analyze, translate } = { ...realDeps, ...deps };
  const horizon = horizonOf(timeframe);
  const stock = coin.class === 'stock';
  const budget = stock ? stockSpend : spend;
  const limit = stock ? STOCK_LIMIT_USD : DAILY_LIMIT_USD;
  const key = `${stock ? 'stock' : 'coin'}:${coin.symbol}|${horizon}`;
  const cached = editions.get(key);
  if (cached && now() - cached.at < EDITION_TTL_MS) return cached.data;

  resetSpendDay();
  if (budget.usd >= limit) {
    if (cached) return cached.data;
    throw fail('limit', 503);
  }
  if (inFlight.has(key)) {
    try { return await inFlight.get(key); } catch { throw fail('print', 502); }
  }
  budget.usd += RESERVE_USD;
  let finish;
  const run = new Promise((resolve, reject) => { finish = { resolve, reject }; });
  run.catch(() => {});
  inFlight.set(key, run);
  try {
    const gathered = await collect({ coin, marketFeeds, timeframe, mode: 'live', root });
    if (gathered.items.length < 3) throw Object.assign(new Error('few'), { status: 422 });
    // Stocks: price context for the model, and an honest "no fresh news" answer without calling the model at all
    // when the company itself has fewer than two items in the last 24 hours.
    let quote = null, earnings = null, context;
    if (stock) {
      // One quote for this company only (about a second); the price is context for the model, never a reason to fail.
      try { quote = await yahoo(coin.symbol, coin.name); } catch { /* no price */ }
      const open = usMarketOpen(new Date(now()));
      try { earnings = await nextEarnings(coin.symbol, { now: now() }); } catch { /* no calendar */ }
      const e = earnings;
      context = `the US market is ${open ? 'open' : 'closed'} now${quote?.change != null ? `; the shares moved ${quote.change >= 0 ? '+' : ''}${quote.change.toFixed(1)}% in the last session` : ''}${e ? `; the company reports earnings ${e.offset === 0 ? 'today' : e.offset === 1 ? 'tomorrow' : `in ${e.offset} days`}${e.when === 'pre' ? ' before the open' : e.when === 'post' ? ' after the close' : ''}` : ''}`;
      const own = gathered.items.filter(it => it.kind === 'project' || it.kind === 'coin').length;
      if (own < 2) {
        const data = {
          edition: { at: new Date(now()).toISOString(), model: null, items: gathered.items.length, shared_minutes: 30 },
          asset: 'stock', quiet: true, market_open: open, earnings, price: quote ? { value: quote.value, change: quote.change } : null,
          direction: 'sideways', verdict: `No fresh news for ${coin.symbol}`, verdict_ru: `Свежих новостей по ${coin.symbol} нет`,
          spot_futures_note: 'Quiet companies can still gap at the open on market-wide news.', spot_futures_note_ru: 'Тихие компании всё равно могут дать гэп на открытии из-за общего фона рынка.',
          horizon, notes: { chain: [], dispatches: [] }, x_connected: false, missing_sources: gathered.missing, cost: { usd: 0, model: null, shared: true }
        };
        budget.usd -= RESERVE_USD;
        editions.set(key, { at: now(), data });
        finish.resolve(data);
        return data;
      }
    }
    const { answer, usage, model } = await analyze({ coin, plan: 'long', horizon, items: gathered.items, model: MODEL, assetClass: stock ? 'stock' : 'crypto', context });
    const checked = check(answer, { plan: 'long', items: gathered.items });
    const usd = costOf(usage, MODEL);
    budget.usd += usd - RESERVE_USD;
    const byNumber = new Map(gathered.items.map(it => [it.n, it]));
    const cited = [...new Set(checked.answer.chain.flatMap(c => c.cites))].sort((a, b) => a - b);
    // Russian titles for the cited dispatches; if the translator fails the titles stay in English.
    let titlesRu = new Map(), trUsd = RESERVE_USD;
    budget.usd += RESERVE_USD;
    try {
      const tr = await translate(cited.map(n => byNumber.get(n).title));
      titlesRu = tr.ru;
      trUsd = costOf(tr.usage, tr.model);
    } catch (err) { console.error('[translate edition]', err.message); }
    budget.usd += trUsd - RESERVE_USD;
    const data = {
      edition: { at: new Date().toISOString(), model, items: gathered.items.length, shared_minutes: 30 },
      direction: checked.answer.direction,
      verdict: checked.answer.verdict,
      verdict_ru: checked.answer.verdict_ru,
      spot_futures_note: checked.answer.spot_futures_note,
      spot_futures_note_ru: checked.answer.spot_futures_note_ru,
      horizon,
      ...(stock ? { asset: 'stock', earnings, market_open: usMarketOpen(new Date(now())), price: quote ? { value: quote.value, change: quote.change } : null } : {}),
      notes: { chain: checked.answer.chain, dispatches: cited.map(n => ({ n, title: byNumber.get(n).title, title_ru: titlesRu.get(byNumber.get(n).title), source: byNumber.get(n).source, link: byNumber.get(n).link })) },
      x_connected: false,
      missing_sources: gathered.missing,
      cost: { usd: usd + trUsd, model, shared: true }
    };
    editions.set(key, { at: now(), data });
    if (!deps.analyze && !stock) recordVerdict(root, { coin, plan: 'long', timeframe, direction: data.direction, verdict: data.verdict, model });
    finish.resolve(data);
    return data;
  } catch (err) {
    finish.reject(err);
    if (err.status === 422) throw fail('few', 422);
    console.error('[edition]', err);
    if (cached) return cached.data;
    throw fail('print', 502);
  } finally {
    inFlight.delete(key);
  }
}

// Russian titles for any list of English texts (the bot's news pages). Uses the same daily limit as editions;
// past the limit, or on any failure, the caller simply keeps the English.
export async function translateBatch(texts, { deps = {} } = {}) {
  const { translate } = { ...realDeps, ...deps };
  const list = [...new Set(texts.filter(Boolean))];
  if (!list.length) return new Map();
  resetSpendDay();
  if (transSpend.day !== spend.day) { transSpend.day = spend.day; transSpend.usd = 0; }
  if (spend.usd >= DAILY_LIMIT_USD || transSpend.usd >= TRANSLATE_LIMIT_USD) return new Map();
  spend.usd += RESERVE_USD;
  transSpend.usd += RESERVE_USD;
  try {
    const tr = await translate(list);
    const cost = costOf(tr.usage, tr.model);
    spend.usd += cost - RESERVE_USD;
    transSpend.usd += cost - RESERVE_USD;
    return tr.ru;
  } catch (err) {
    spend.usd -= RESERVE_USD;
    transSpend.usd -= RESERVE_USD;
    console.error('[translate batch]', err.message);
    return new Map();
  }
}
