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
    quotes: [
      { name: 'Bitcoin', value: '$82,978', change: -1.2 },
      { name: 'Ether', value: '$2,500', change: 0.8 },
      { name: 'Solana', value: '$109.40', change: -2.1 },
      { name: 'Aave', value: '$167.40', change: 1.5 },
      { name: 'Nasdaq', value: '18,342.6', change: 0.4 },
      { name: 'S&P 500', value: '5,812.3', change: 0.2 },
      { name: 'Dow Jones', value: '42,310', change: -0.1 },
      { name: 'Gold', value: '$2,664', change: 0.6 },
      { name: 'Brent oil', value: '$74.20', change: -1.4 },
      { name: 'Dollar index', value: '103.1', change: 0.1 },
      { name: 'EUR/USD', value: '1.0921', change: -0.2 },
      { name: 'US 10-year yield', value: '4.08%', change: 0.03, unit: 'pt' }
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
