// Edition Printer: one fresh edition per coin and horizon, shared by everyone who asks for
// 30 minutes, under one daily spending limit. The public site and the Telegram bot both
// print through here, so the limit and the cache are never doubled.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collect, horizonOf } from './collect.js';
import { check } from './check.js';
import { recordVerdict } from './journal.js';

export const MODEL = process.env.MODEL || 'claude-haiku-5-5';
export const EDITION_TTL_MS = 30 * 60 * 1000;
export const DAILY_LIMIT_USD = Number(process.env.DAILY_LIMIT_USD || 0.5);
export const RESERVE_USD = 0.002; // set aside before each call so parallel requests cannot pass the limit
export const spend = { day: '', usd: 0 };

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
}

const fail = (reason, status) => Object.assign(new Error(reason), { reason, status });

// Returns the edition data, or throws an error with reason "limit", "few" or "print".
export async function getEdition(coin, timeframe, { root, marketFeeds, deps = {}, now = () => Date.now() }) {
  const { analyze, translate } = { ...realDeps, ...deps };
  const horizon = horizonOf(timeframe);
  const key = `${coin.symbol}|${horizon}`;
  const cached = editions.get(key);
  if (cached && now() - cached.at < EDITION_TTL_MS) return cached.data;

  resetSpendDay();
  if (spend.usd >= DAILY_LIMIT_USD) {
    if (cached) return cached.data;
    throw fail('limit', 503);
  }
  if (inFlight.has(key)) {
    try { return await inFlight.get(key); } catch { throw fail('print', 502); }
  }
  spend.usd += RESERVE_USD;
  let finish;
  const run = new Promise((resolve, reject) => { finish = { resolve, reject }; });
  run.catch(() => {});
  inFlight.set(key, run);
  try {
    const gathered = await collect({ coin, marketFeeds, timeframe, mode: 'live', root });
    if (gathered.items.length < 3) throw Object.assign(new Error('few'), { status: 422 });
    const { answer, usage, model } = await analyze({ coin, plan: 'long', horizon, items: gathered.items, model: MODEL });
    const checked = check(answer, { plan: 'long', items: gathered.items });
    const usd = costOf(usage, MODEL);
    spend.usd += usd - RESERVE_USD;
    const byNumber = new Map(gathered.items.map(it => [it.n, it]));
    const cited = [...new Set(checked.answer.chain.flatMap(c => c.cites))].sort((a, b) => a - b);
    // Russian titles for the cited dispatches; if the translator fails the titles stay in English.
    let titlesRu = new Map(), trUsd = RESERVE_USD;
    spend.usd += RESERVE_USD;
    try {
      const tr = await translate(cited.map(n => byNumber.get(n).title));
      titlesRu = tr.ru;
      trUsd = costOf(tr.usage, tr.model);
    } catch (err) { console.error('[translate edition]', err.message); }
    spend.usd += trUsd - RESERVE_USD;
    const data = {
      edition: { at: new Date().toISOString(), model, items: gathered.items.length, shared_minutes: 30 },
      direction: checked.answer.direction,
      verdict: checked.answer.verdict,
      verdict_ru: checked.answer.verdict_ru,
      spot_futures_note: checked.answer.spot_futures_note,
      spot_futures_note_ru: checked.answer.spot_futures_note_ru,
      horizon,
      notes: { chain: checked.answer.chain, dispatches: cited.map(n => ({ n, title: byNumber.get(n).title, title_ru: titlesRu.get(byNumber.get(n).title), source: byNumber.get(n).source, link: byNumber.get(n).link })) },
      x_connected: false,
      missing_sources: gathered.missing,
      cost: { usd: usd + trUsd, model, shared: true }
    };
    editions.set(key, { at: now(), data });
    if (!deps.analyze) recordVerdict(root, { coin, plan: 'long', timeframe, direction: data.direction, verdict: data.verdict, model });
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
  if (spend.usd >= DAILY_LIMIT_USD) return new Map();
  spend.usd += RESERVE_USD;
  try {
    const tr = await translate(list);
    spend.usd += costOf(tr.usage, tr.model) - RESERVE_USD;
    return tr.ru;
  } catch (err) {
    spend.usd -= RESERVE_USD;
    console.error('[translate batch]', err.message);
    return new Map();
  }
}
