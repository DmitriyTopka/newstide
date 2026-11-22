// Market Strip Service: 4 quotes for the running tape and the day's / week's headlines.
import { fetchAll } from './collect.js';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) NewsTide/0.1';
const CACHE_MS = 5 * 60 * 1000;
let cache = null;

const usd = v => `$${v.toLocaleString('en-US', { maximumFractionDigits: v < 100 ? 2 : 0 })}`;

async function crypto() {
  const url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true';
  const d = await (await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) })).json();
  return [
    { name: 'Bitcoin', value: usd(d.bitcoin.usd), change: d.bitcoin.usd_24h_change },
    { name: 'Ether', value: usd(d.ethereum.usd), change: d.ethereum.usd_24h_change }
  ];
}

// Yahoo Finance chart endpoint (unofficial, no key). May stop working; the cell then shows "no data".
export async function yahoo(symbol, name) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
  const d = await (await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) })).json();
  const m = d.chart.result[0].meta;
  const prev = m.chartPreviousClose ?? m.previousClose;
  return {
    name,
    value: m.regularMarketPrice.toLocaleString('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 }),
    change: prev ? ((m.regularMarketPrice - prev) / prev) * 100 : 0
  };
}

const brief = it => ({ title: it.title, source: it.source, summary: it.summary, link: it.link });

function newest(items, kinds, hours, count) {
  const since = Date.now() - hours * 3600 * 1000;
  const bySource = new Map();
  items
    .filter(it => kinds.includes(it.kind) && Date.parse(it.date) >= since)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .forEach(it => { if (!bySource.has(it.source)) bySource.set(it.source, []); bySource.get(it.source).push(it); });
  const out = [];
  for (let round = 0; out.length < count; round++) {
    const before = out.length;
    for (const list of bySource.values()) if (list[round] && out.length < count) out.push(list[round]);
    if (out.length === before) break;
  }
  return out.map(brief);
}

// Top stock-market and macro values next to the crypto ones: US indices, fear index, dollar, gold, oil.
const STOCKS = [['^GSPC', 'S&P 500'], ['^IXIC', 'Nasdaq'], ['^DJI', 'Dow Jones'], ['^VIX', 'VIX'], ['DX-Y.NYB', 'Dollar index'], ['GC=F', 'Gold'], ['CL=F', 'Oil']];
const noData = name => ({ name, value: 'no data', change: null });
let quotesCache = null;

// All quotes for the tape and the bot: crypto first, then stocks and macro. Cached for 5 minutes.
export async function marketQuotes() {
  if (quotesCache && Date.now() - quotesCache.at < CACHE_MS) return quotesCache.data;
  const [c, ...rest] = await Promise.allSettled([crypto(), ...STOCKS.map(([sym, name]) => yahoo(sym, name))]);
  const data = [
    ...(c.status === 'fulfilled' ? c.value : [noData('Bitcoin'), noData('Ether')]),
    ...rest.map((r, i) => (r.status === 'fulfilled' ? r.value : noData(STOCKS[i][1])))
  ];
  quotesCache = { at: Date.now(), data };
  return data;
}

export async function market(marketFeeds) {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  const [q, news] = await Promise.allSettled([marketQuotes(), fetchAll(marketFeeds)]);
  const quotes = q.status === 'fulfilled' ? q.value : [noData('Bitcoin'), noData('Ether'), ...STOCKS.map(([, n]) => noData(n))];
  const items = news.status === 'fulfilled' ? news.value.items : [];
  const data = {
    sample: false,
    quotes,
    today: newest(items, ['crypto'], 24, 3),
    week: newest(items, ['macro'], 24 * 7, 3)
  };
  cache = { at: Date.now(), data };
  return data;
}
