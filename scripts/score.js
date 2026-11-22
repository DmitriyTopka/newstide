// Score Board: compares each journalled verdict with the price 4 hours or 1 day after it.
// Run: node scripts/score.js   (reads data/journal/verdicts.jsonl, writes data/journal/scored.jsonl)
// A verdict "hits" when up was followed by a rise, down by a fall, and sideways by a move
// smaller than SIDEWAYS_BAND percent. The band is our own working choice, not a market rule.
import { readFile, appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { journalDir } from '../server/journal.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dir = journalDir(root);
const SIDEWAYS_BAND = 1.5;
const AFTER_MS = { '4h': 4 * 3600e3, '1d': 24 * 3600e3 };

const readLines = async file => {
  try {
    return (await readFile(path.join(dir, file), 'utf8')).split('\n').filter(Boolean).map(l => JSON.parse(l));
  } catch {
    return [];
  }
};

// Price closest to the wanted moment, from CoinGecko's free range endpoint.
async function priceAt(id, ms) {
  const from = Math.floor((ms - 3 * 3600e3) / 1000);
  const to = Math.floor((ms + 3 * 3600e3) / 1000);
  const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart/range?vs_currency=usd&from=${from}&to=${to}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
  const { prices = [] } = await res.json();
  if (!prices.length) return null;
  return prices.reduce((best, p) => (Math.abs(p[0] - ms) < Math.abs(best[0] - ms) ? p : best))[1];
}

const verdicts = await readLines('verdicts.jsonl');
const done = await readLines('scored.jsonl');
const doneKeys = new Set(done.map(d => d.key));
const rows = [...done];

for (const v of verdicts) {
  const key = `${v.at}|${v.coin}|${v.timeframe}`;
  const due = Date.parse(v.at) + AFTER_MS[v.timeframe];
  if (doneKeys.has(key) || !v.price_usd || !v.coingecko || due > Date.now()) continue;
  try {
    const later = await priceAt(v.coingecko, due);
    if (later == null) continue;
    const change = ((later - v.price_usd) / v.price_usd) * 100;
    const hit = v.direction === 'up' ? change > 0 : v.direction === 'down' ? change < 0 : Math.abs(change) < SIDEWAYS_BAND;
    const row = { key, coin: v.coin, timeframe: v.timeframe, direction: v.direction, change_pct: Number(change.toFixed(2)), hit };
    await mkdir(dir, { recursive: true });
    await appendFile(path.join(dir, 'scored.jsonl'), JSON.stringify(row) + '\n');
    rows.push(row);
    await new Promise(r => setTimeout(r, 2500)); // the free API is rate limited
  } catch (err) {
    console.error(`skip ${key}: ${err.message}`);
  }
}

const pending = verdicts.length - rows.length;
const hits = rows.filter(r => r.hit).length;
console.log(`Verdicts: ${verdicts.length}, scored: ${rows.length}, waiting or without price: ${pending}`);
if (rows.length) console.log(`Hit rate: ${hits}/${rows.length} = ${Math.round((hits / rows.length) * 100)}% (sideways counts as a hit inside +-${SIDEWAYS_BAND}%)`);
const byCoin = {};
for (const r of rows) (byCoin[r.coin] ??= []).push(r.hit);
for (const [coin, list] of Object.entries(byCoin)) console.log(`  ${coin}: ${list.filter(Boolean).length}/${list.length}`);
