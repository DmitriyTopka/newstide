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
const coins = JSON.parse(await readFile(path.join(root, 'config/coins.json'), 'utf8'));
const marketFeeds = JSON.parse(await readFile(path.join(root, 'config/feeds.json'), 'utf8'));
const prices = JSON.parse(await readFile(path.join(root, 'config/prices.json'), 'utf8'));
const MODEL = process.env.MODEL || 'claude-haiku-5-5';
const DATA_MODE = process.env.DATA_MODE === 'live' ? 'live' : 'sample';
// REPLAY=1: the public demo. Serves archived editions (real runs on live news) and never calls the AI.
const REPLAY = process.env.REPLAY === '1';
const replay = REPLAY ? JSON.parse(await readFile(path.join(root, 'data/replay/editions.json'), 'utf8')) : null;
// The AI client is loaded only when it is needed, so the demo runs without any key.
const analyze = async (...args) => (await import('./analyst.js')).analyze(...args);

const app = express();
app.use(express.json());
app.use(express.static(path.join(root, 'public')));

// The coin list for the suggestions under the coin field.
app.get('/api/mode', (req, res) => res.json({ replay: REPLAY }));

app.get('/api/coins', (req, res) => {
  res.json(coins.map(({ symbol, name }) => ({ symbol, name })));
});

// The market strip: live quotes and headlines, cached for 5 minutes.
app.get('/api/market', async (req, res) => {
  try {
    res.json(await market(marketFeeds));
  } catch (err) {
    console.error('[market]', err);
    res.json({ sample: false, quotes: [], today: [], week: [] });
  }
});

const TIMEFRAMES = ['15m', '1h', '4h', '1d'];

function costOf(usage, model) {
  const p = prices[model] ?? prices[MODEL];
  if (!p || !usage) return 0;
  const input = (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
  return (input * p.input + (usage.output_tokens ?? 0) * p.output) / 1e6;
}

app.post('/api/analyze', async (req, res) => {
  const { plan, timeframe } = req.body ?? {};
  const symbol = String(req.body?.coin ?? '').trim().toUpperCase();
  const coin = coins.find(c => c.symbol === symbol);
  if (!coin || !['long', 'short'].includes(plan) || !TIMEFRAMES.includes(timeframe)) {
    const what = !coin ? 'Pick ETH, SOL or AAVE.' : !['long', 'short'].includes(plan) ? 'Choose Long or Short.' : 'Choose a timeframe: 15m, 1h, 4h or 1d.';
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
      spot_futures_note: ed.spot_futures_note,
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
      spot_futures_note: checked.answer.spot_futures_note,
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
