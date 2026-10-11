import express from 'express';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const coins = JSON.parse(await readFile(path.join(root, 'config/coins.json'), 'utf8'));

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
    btc: { usd: 82978, change24h: -1.2 },
    nasdaq: { value: 18342.6, change: 0.4 },
    today: [
      { title: 'Spot ether ETFs see second day of inflows', source: 'CoinDesk' },
      { title: 'Solana validators approve fee change', source: 'Cointelegraph' },
      { title: 'Stablecoin supply reaches new high', source: 'CoinDesk' }
    ],
    week: [
      { title: 'Fed holds rates, signals patience on cuts', source: 'Federal Reserve' },
      { title: 'US inflation cools slightly in September', source: 'MarketWatch' },
      { title: 'Oil slips as supply worries ease', source: 'Investing' }
    ]
  });
});

// SAMPLE ONLY (slice 1): one fixed answer per coin so all three looks can be seen.
const samples = {
  ETH: { direction: 'up', verdict: 'Growth expected for ETH', spot_futures_note: 'Spot and futures point the same way.' },
  SOL: { direction: 'down', verdict: 'Correction for SOL', spot_futures_note: 'Futures may feel it faster than spot.' },
  AAVE: { direction: 'sideways', verdict: 'Neutral for now', spot_futures_note: 'No clear push on spot or futures.' }
};
const fit = (plan, direction) =>
  direction === 'sideways' ? 'mixed' : (plan === 'long') === (direction === 'up') ? 'supports' : 'against';

app.post('/api/analyze', async (req, res) => {
  const { coin, plan, timeframe } = req.body ?? {};
  if (!samples[coin] || !['long', 'short'].includes(plan) || !['15m', '1h', '4h', '1d'].includes(timeframe)) {
    return res.status(400).json({ error: 'Pick a coin from the list, Long or Short, and a timeframe.' });
  }
  await new Promise(r => setTimeout(r, 2500));
  const s = samples[coin];
  res.json({
    sample: true,
    ...s,
    plan_fit: fit(plan, s.direction),
    horizon: ['15m', '1h'].includes(timeframe) ? 'intraday' : 'medium',
    x_connected: false,
    missing_sources: [],
    cost: { usd: 0, model: 'sample' }
  });
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`NewsTide is running at http://localhost:${port}`));
