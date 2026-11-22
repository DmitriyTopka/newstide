// Stocks: the 50 largest US companies with price and day change, from Yahoo Finance (unofficial, no key).
// One refresh every 5 minutes for everybody; a company that does not answer shows "no data".
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { yahoo } from './market.js';

const CACHE_MS = 5 * 60 * 1000;
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const list = JSON.parse(await readFile(path.join(root, 'config/stocks.json'), 'utf8')).stocks;
let cache = null;
let inFlight = null;

async function load() {
  const out = [];
  // Ten at a time, so Yahoo is not hit with fifty requests at once.
  for (let i = 0; i < list.length; i += 10) {
    const part = await Promise.allSettled(list.slice(i, i + 10).map(s => yahoo(s.symbol, s.name)));
    part.forEach((r, j) => {
      const s = list[i + j];
      out.push({ rank: i + j + 1, symbol: s.symbol, name: s.name, ...(r.status === 'fulfilled' ? { value: r.value.value, change: r.value.change } : { value: null, change: null }) });
    });
  }
  return out;
}

export async function stockQuotes() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  inFlight ??= load().then(data => { cache = { at: Date.now(), data }; return data; }).finally(() => { inFlight = null; });
  return inFlight;
}
