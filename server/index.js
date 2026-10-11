import express from 'express';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { collect } from './collect.js';
import { analyze } from './analyst.js';
import { check } from './check.js';
import { saveRun } from './log.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const coins = JSON.parse(await readFile(path.join(root, 'config/coins.json'), 'utf8'));
const marketFeeds = JSON.parse(await readFile(path.join(root, 'config/feeds.json'), 'utf8'));
const prices = JSON.parse(await readFile(path.join(root, 'config/prices.json'), 'utf8'));
const MODEL = process.env.MODEL || 'claude-haiku-5-5';
const DATA_MODE = process.env.DATA_MODE === 'live' ? 'live' : 'sample';

const app = express();
app.use(express.json());
app.use(express.static(path.join(root, 'public')));

// The coin list for the suggestions under the coin field.
app.get('/api/coins', (req, res) => {
  res.json(coins.map(({ symbol, name }) => ({ symbol, name })));
});

// SAMPLE ONLY (slice 1): fixed market strip until the live strip is built.
app.get('/api/market', (req, res) => {
  res.json({
    sample: true,
    quotes: [
      { name: 'Bitcoin', value: '$82,978', change: -1.2 },
      { name: 'Ether', value: '$2,500', change: 0.8 },
      { name: 'S&P 500', value: '5,812.3', change: 0.2 },
      { name: 'Dollar index', value: '103.1', change: 0.1 }
    ],
    today: [
      { title: 'Spot ether ETFs see second day of inflows', source: 'CoinDesk',
        summary: 'US spot ether funds took in fresh money for a second session, led by the largest issuers. Analysts read it as institutions returning after a quiet month.' },
      { title: 'Solana validators approve fee change', source: 'Cointelegraph',
        summary: 'A governance vote among Solana validators passed a change to how priority fees are shared. It takes effect at the next epoch boundary.' },
      { title: 'Stablecoin supply reaches new high', source: 'CoinDesk',
        summary: 'The combined supply of the largest dollar stablecoins rose to a record, often read as dry powder waiting on the sidelines of the crypto market.' }
    ],
    week: [
      { title: 'Fed holds rates, signals patience on cuts', source: 'Federal Reserve',
        summary: 'The Federal Reserve kept its policy rate unchanged and said it wants more evidence that inflation is cooling before cutting.' },
      { title: 'US inflation cools slightly in September', source: 'MarketWatch',
        summary: 'Consumer prices rose a little less than expected last month, giving markets some hope for a rate cut later this year.' },
      { title: 'Oil slips as supply worries ease', source: 'Investing',
        summary: 'Crude prices fell as concerns about supply disruptions faded, easing pressure on inflation expectations.' }
    ]
  });
});

const TIMEFRAMES = ['15m', '1h', '4h', '1d'];

function costOf(usage, model) {
  const p = prices[model] ?? prices[MODEL];
  if (!p || !usage) return 0;
  const input = (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
  return (input * p.input + (usage.output_tokens ?? 0) * p.output) / 1e6;
}

app.post('/api/analyze', async (req, res) => {
  const { coin: symbol, plan, timeframe } = req.body ?? {};
  const coin = coins.find(c => c.symbol === symbol);
  if (!coin || !['long', 'short'].includes(plan) || !TIMEFRAMES.includes(timeframe)) {
    return res.status(400).json({ error: 'Pick a coin from the list, Long or Short, and a timeframe.' });
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
    res.status(502).json({ error: timeout ? 'Took too long. Try again in a moment.' : 'The paper could not be printed: ' + (err?.message ?? 'unknown error') });
  }
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`NewsTide is running at http://localhost:${port} (model ${MODEL}, ${DATA_MODE} data)`));
