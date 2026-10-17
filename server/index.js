import express from 'express';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { collect } from './collect.js';
import { check, expectedFit } from './check.js';
import { horizonOf } from './collect.js';
import { saveRun } from './log.js';
import { market } from './market.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const allCoins = JSON.parse(await readFile(path.join(root, 'config/coins.json'), 'utf8'));
const marketFeeds = JSON.parse(await readFile(path.join(root, 'config/feeds.json'), 'utf8'));
const prices = JSON.parse(await readFile(path.join(root, 'config/prices.json'), 'utf8'));
const MODEL = process.env.MODEL || 'claude-haiku-5-5';
const DATA_MODE = process.env.DATA_MODE === 'live' ? 'live' : 'sample';
// REPLAY=1: the public demo. Serves archived editions (real runs on live news) and never calls the AI.
const REPLAY = process.env.REPLAY === '1';
const replay = REPLAY ? JSON.parse(await readFile(path.join(root, 'data/replay/editions.json'), 'utf8')) : null;
// The replay demo only offers the coins it has archived editions for.
const coins = REPLAY ? allCoins.filter(c => Object.keys(replay.editions).some(k => k.startsWith(c.symbol + '|'))) : allCoins;
// PUBLIC_LIVE=1: the public live site. One fresh edition per coin and horizon, shared by every reader
// for 30 minutes (server memory + CDN cache), and a daily spending limit, so visitors cannot run up the bill.
const PUBLIC_LIVE = process.env.PUBLIC_LIVE === '1';
const EDITION_TTL_MS = 30 * 60 * 1000;
const DAILY_LIMIT_USD = Number(process.env.DAILY_LIMIT_USD || 0.5);
const editions = new Map();
const inFlight = new Map(); // one print run per coin and horizon at a time
const RESERVE_USD = 0.002;   // set aside before each call so parallel requests cannot pass the limit
const spend = { day: '', usd: 0 };
// When no fresh edition can be printed, readers are sent to the archived demo instead of a dead end.
const DEMO_URL = 'https://newstide-paper.vercel.app';
// The AI client is loaded only when it is needed, so the demo runs without any key.
const analyze = async (...args) => (await import('./analyst.js')).analyze(...args);
const translate = async (...args) => (await import('./translate.js')).translate(...args);
// The demo has no key: it borrows the Russian news columns from the live site, which translates them.
const LIVE_URL = 'https://newstide-live.vercel.app';

const TIMEFRAMES = ['15m', '1h', '4h', '1d'];

const app = express();
app.use(express.json());
app.use(express.static(path.join(root, 'public')));

// The coin list for the suggestions under the coin field.
app.get('/api/mode', (req, res) => res.json({ replay: REPLAY, public_live: PUBLIC_LIVE }));

// Public live edition: the same answer for every reader of a coin and horizon for 30 minutes.
app.get('/api/edition', async (req, res) => {
  if (!PUBLIC_LIVE) return res.status(404).json({ error: 'Not available.' });
  const symbol = String(req.query.coin ?? '').trim().toUpperCase();
  const timeframe = String(req.query.timeframe ?? '');
  const coin = coins.find(c => c.symbol === symbol);
  if (!coin || !TIMEFRAMES.includes(timeframe)) return res.status(400).json({ error: 'Pick a coin from the list and a timeframe.' });
  const horizon = horizonOf(timeframe);
  const key = `${symbol}|${horizon}`;
  const cached = editions.get(key);
  const sendCached = c => {
    res.set('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=600');
    return res.json(c.data);
  };
  if (cached && Date.now() - cached.at < EDITION_TTL_MS) return sendCached(cached);

  const today = new Date().toISOString().slice(0, 10);
  if (spend.day !== today) { spend.day = today; spend.usd = 0; }
  if (spend.usd >= DAILY_LIMIT_USD) {
    if (cached) return sendCached(cached);
    return res.status(503).json({ error: 'Today\'s free editions are used up. Come back tomorrow, or read the archived editions in the demo.', reason: 'limit', demo: DEMO_URL });
  }
  if (inFlight.has(key)) {
    try { return sendCached({ data: await inFlight.get(key) }); }
    catch { return res.status(502).json({ error: 'The paper could not be printed this time. Try again in a moment.', reason: 'print', demo: DEMO_URL }); }
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
    let titlesRu = new Map(), trUsd = 0;
    try {
      const tr = await translate(cited.map(n => byNumber.get(n).title));
      titlesRu = tr.ru;
      trUsd = costOf(tr.usage, tr.model);
    } catch (err) { console.error('[translate edition]', err.message); }
    spend.usd += trUsd;
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
    editions.set(key, { at: Date.now(), data });
    finish.resolve(data);
    sendCached({ data });
  } catch (err) {
    finish.reject(err);
    if (err.status === 422) return res.status(422).json({ error: 'Not enough news to judge right now. Try again later.' });
    console.error('[edition]', err);
    if (cached) return sendCached(cached);
    res.status(502).json({ error: 'The paper could not be printed this time. Try again in a moment.', reason: 'print', demo: DEMO_URL });
  } finally {
    inFlight.delete(key);
  }
});

app.get('/api/coins', (req, res) => {
  res.json(coins.map(({ symbol, name }) => ({ symbol, name })));
});

// The market strip: live quotes and headlines, cached for 5 minutes.
app.get('/api/market', async (req, res) => {
  try {
    if (REPLAY) {
      // The demo calls no AI itself: it shows the live site's columns, Russian included.
      try {
        const r = await fetch(`${LIVE_URL}/api/market`, { signal: AbortSignal.timeout(8000) });
        if (r.ok) return res.json(await r.json());
      } catch (err) { console.error('[market from live]', err.message); }
      return res.json(await market(marketFeeds));
    }
    const data = await market(marketFeeds);
    if (PUBLIC_LIVE) {
      res.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=120');
      await withRussian(data);
    }
    res.json(data);
  } catch (err) {
    console.error('[market]', err);
    res.json({ sample: false, quotes: [], today: [], week: [] });
  }
});

// Russian twins for the day's and week's headlines and summaries. Each text is translated once;
// past the daily spending limit, or if the translator fails, the columns simply stay in English.
async function withRussian(data) {
  const list = [...(data.today ?? []), ...(data.week ?? [])];
  const texts = list.flatMap(n => [n.title, n.summary]).filter(Boolean);
  if (!texts.length) return;
  const today = new Date().toISOString().slice(0, 10);
  if (spend.day !== today) { spend.day = today; spend.usd = 0; }
  if (spend.usd >= DAILY_LIMIT_USD) return;
  try {
    const tr = await translate(texts);
    spend.usd += costOf(tr.usage, tr.model);
    for (const n of list) {
      if (tr.ru.has(n.title)) n.title_ru = tr.ru.get(n.title);
      if (n.summary && tr.ru.has(n.summary)) n.summary_ru = tr.ru.get(n.summary);
    }
  } catch (err) { console.error('[translate market]', err.message); }
}

function costOf(usage, model) {
  const p = prices[model] ?? prices[MODEL];
  if (!p || !usage) return 0;
  const input = (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
  return (input * p.input + (usage.output_tokens ?? 0) * p.output) / 1e6;
}

app.post('/api/analyze', async (req, res) => {
  // On the public live site every analysis must go through the shared, limited /api/edition.
  if (PUBLIC_LIVE) return res.status(404).json({ error: 'Not available.' });
  const { plan, timeframe } = req.body ?? {};
  const symbol = String(req.body?.coin ?? '').trim().toUpperCase();
  const coin = coins.find(c => c.symbol === symbol);
  if (!coin || !['long', 'short'].includes(plan) || !TIMEFRAMES.includes(timeframe)) {
    const what = !coin ? 'Pick a coin from the list.' : !['long', 'short'].includes(plan) ? 'Choose Long or Short.' : 'Choose a timeframe: 15m, 1h, 4h or 1d.';
    return res.status(400).json({ error: what });
  }
  if (REPLAY) {
    const ed = replay.editions[`${symbol}|${horizonOf(timeframe)}`];
    await new Promise(r => setTimeout(r, 1200));
    return res.json({
      sample: false,
      archived: { at: ed.at, model: ed.model, items: ed.items_count },
      direction: ed.direction,
      plan_fit: expectedFit(plan, ed.direction),
      verdict: ed.verdict,
      verdict_ru: ed.verdict_ru,
      spot_futures_note: ed.spot_futures_note,
      spot_futures_note_ru: ed.spot_futures_note_ru,
      horizon: horizonOf(timeframe),
      notes: { chain: ed.chain, dispatches: ed.dispatches },
      x_connected: false,
      missing_sources: ed.missing_sources,
      cost: { usd: ed.cost_usd, model: ed.model, archived: true }
    });
  }

  const at = new Date().toISOString();
  try {
    const gathered = await collect({ coin, marketFeeds, timeframe, mode: DATA_MODE, root });
    if (gathered.items.length < 3) {
      return res.status(422).json({ error: 'Not enough news to judge right now. Try again later.', missing_sources: gathered.missing });
    }
    const { answer, usage, model } = await analyze({ coin, plan, horizon: gathered.horizon, items: gathered.items, model: MODEL });
    const checked = check(answer, { plan, items: gathered.items });
    const usd = costOf(usage, MODEL);
    const byNumber = new Map(gathered.items.map(it => [it.n, it]));
    const citedNumbers = [...new Set(checked.answer.chain.flatMap(c => c.cites))].sort((a, b) => a - b);
    const run = {
      at, input: { coin: symbol, plan, timeframe }, horizon: gathered.horizon, data_mode: DATA_MODE, model,
      items: gathered.items, missing_sources: gathered.missing, answer, checked: checked.answer,
      checker: { problems: checked.problems, cites_ok: checked.citesOk }, usage, cost_usd: usd
    };
    const logFile = await saveRun(root, run);
    if (checked.problems.length) console.warn(`[checker] ${symbol}: ${checked.problems.join('; ')}`);
    res.json({
      sample: gathered.sample,
      direction: checked.answer.direction,
      plan_fit: checked.answer.plan_fit,
      verdict: checked.answer.verdict,
      verdict_ru: checked.answer.verdict_ru,
      spot_futures_note: checked.answer.spot_futures_note,
      spot_futures_note_ru: checked.answer.spot_futures_note_ru,
      horizon: gathered.horizon,
      notes: {
        chain: checked.answer.chain,
        dispatches: citedNumbers.map(n => ({ n, title: byNumber.get(n).title, source: byNumber.get(n).source, link: byNumber.get(n).link }))
      },
      x_connected: false,
      missing_sources: gathered.missing,
      cost: { usd, model, input_tokens: usage?.input_tokens ?? 0, output_tokens: usage?.output_tokens ?? 0 },
      log: logFile
    });
  } catch (err) {
    console.error('[analyze]', err);
    const timeout = err?.name === 'APIConnectionTimeoutError' || /timed? ?out/i.test(String(err?.message));
    res.status(502).json({ error: timeout ? 'Took too long. Try again in a moment.' : 'The paper could not be printed this time. Try again in a moment.' });
  }
});

// Broken requests (for example invalid JSON) get a short JSON answer, never a stack trace.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  res.status(err.status && err.status < 500 ? err.status : 500).json({ error: 'Bad request.' });
});

export default app;

if (!process.env.VERCEL) {
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => console.log(`NewsTide is running at http://localhost:${port} (${REPLAY ? 'replay of archived editions' : `model ${MODEL}, ${DATA_MODE} data`})`));
}
