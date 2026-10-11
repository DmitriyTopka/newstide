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

// SAMPLE ONLY (slice 1): one fixed answer per coin so all three looks can be seen.
const samples = {
  ETH: {
    direction: 'up', verdict: 'Growth expected for ETH', spot_futures_note: 'Spot and futures point the same way.',
    notes: {
      chain: [
        { step: 'The Fed held rates and US inflation cooled, so risk appetite holds.', cites: [1, 2] },
        { step: 'Money keeps flowing into spot ether funds for a second day.', cites: [3] },
        { step: 'A calmer macro week plus fresh inflows lean the background up for ETH.', cites: [1, 3] }
      ],
      dispatches: [
        { n: 1, title: 'Fed holds rates, signals patience on cuts', source: 'Federal Reserve' },
        { n: 2, title: 'US inflation cools slightly in September', source: 'MarketWatch' },
        { n: 3, title: 'Spot ether ETFs see second day of inflows', source: 'CoinDesk' }
      ]
    }
  },
  SOL: {
    direction: 'down', verdict: 'Correction for SOL', spot_futures_note: 'Futures may feel it faster than spot.',
    notes: {
      chain: [
        { step: 'A fee change vote on Solana unsettles validators and traders.', cites: [4] },
        { step: 'Cooling inflation helps the market, but not enough to offset the coin news.', cites: [2, 4] }
      ],
      dispatches: [
        { n: 2, title: 'US inflation cools slightly in September', source: 'MarketWatch' },
        { n: 4, title: 'Solana validators approve fee change', source: 'Cointelegraph' }
      ]
    }
  },
  AAVE: {
    direction: 'sideways', verdict: 'Neutral for now', spot_futures_note: 'No clear push on spot or futures.',
    notes: {
      chain: [
        { step: 'Record stablecoin supply is good for lending, but no Aave news moves it today.', cites: [5] }
      ],
      dispatches: [{ n: 5, title: 'Stablecoin supply reaches new high', source: 'CoinDesk' }]
    }
  }
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
