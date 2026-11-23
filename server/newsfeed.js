// News Feed: the full list of current news for the Telegram bot, three sections:
// "mine" (the reader's coins), "crypto" (crypto media) and "world" (macro and geopolitics).
// Feeds are read at most once per 10 minutes, whoever asks.
import { fetchAll, markCoinNews } from './collect.js';

const TTL_MS = 10 * 60 * 1000;
const DAYS = { mine: 1, crypto: 1, world: 1, stocks: 1, market: 1 }; // what happened in the last 24 hours
const MAX_ITEMS = 40;
const cache = new Map(); // key -> { at, promise }

function cached(key, feeds) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise;
  const promise = fetchAll(feeds).then(r => r.items);
  cache.set(key, { at: Date.now(), promise });
  promise.catch(() => cache.delete(key));
  return promise;
}

// Newest first, the same story once, and sources taken in turns so one busy feed cannot fill the page.
function tidy(items, days, now) {
  const since = now - days * 86400e3;
  const seen = new Set();
  const fresh = items
    .filter(it => Date.parse(it.date) >= since && Date.parse(it.date) <= now + 3600e3)
    .filter(it => { const k = it.title.toLowerCase().replace(/ - [^-]{2,40}$/, '').slice(0, 60); if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const bySource = new Map();
  for (const it of fresh) { if (!bySource.has(it.source)) bySource.set(it.source, []); bySource.get(it.source).push(it); }
  const out = [];
  for (let round = 0; out.length < MAX_ITEMS; round++) {
    const before = out.length;
    for (const list of bySource.values()) if (list[round] && out.length < MAX_ITEMS) out.push(list[round]);
    if (out.length === before) break;
  }
  return out.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

export async function getNews(scope, { coins = [], stocks = [], marketFeeds, stockFeeds = [], now = Date.now() }) {
  if (scope === 'market') return tidy(await cached('stockmarket', stockFeeds.filter(f => f.kind !== 'geo')), DAYS.market, now);
  if (scope === 'stocks') {
    const lists = await Promise.all(stocks.map(async s => (await cached(`stock:${s.symbol}`, s.feeds.map(f => ({ ...f, kind: f.kind ?? 'project' })))).map(it => ({ ...it, sym: s.symbol }))));
    return tidy(lists.flat(), DAYS.stocks, now);
  }
  if (scope === 'crypto') return tidy(await cached('crypto', marketFeeds.filter(f => f.kind === 'crypto')), DAYS.crypto, now);
  if (scope === 'world') return tidy(await cached('world', marketFeeds.filter(f => f.kind !== 'crypto')), DAYS.world, now);
  // mine: each followed coin's own feeds plus crypto headlines that name it
  const crypto = await cached('crypto', marketFeeds.filter(f => f.kind === 'crypto'));
  const lists = await Promise.all(coins.map(async coin => {
    const own = await cached(`coin:${coin.symbol}`, coin.feeds.map(f => ({ ...f, kind: f.kind ?? 'project' })));
    const named = markCoinNews(crypto, coin).filter(it => it.kind === 'coin');
    return [...own, ...named].map(it => ({ ...it, sym: coin.symbol }));
  }));
  return tidy(lists.flat(), DAYS.mine, now);
}
