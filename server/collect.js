// Feed Collector: reads the coin's official feeds and the market-wide feeds,
// keeps the items inside the horizon window, removes duplicates, numbers them.
import { XMLParser } from 'fast-xml-parser';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) NewsTide/0.1';
const MAX_ITEMS = 30;
const HOURS = { intraday: 24, medium: 24 * 14 };

export const horizonOf = timeframe => (['15m', '1h'].includes(timeframe) ? 'intraday' : 'medium');

const text = v => (typeof v === 'object' && v !== null ? v['#text'] ?? '' : v ?? '');
const clean = s =>
  String(s)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#([0-9]+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#8217;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s*[\u2013\u2014]\s*/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim();

// Keep only ordinary web links; anything else (javascript:, data:) is dropped.
export function safeLink(link) {
  try {
    const u = new URL(String(link).trim());
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : '';
  } catch {
    return '';
  }
}

// Turn one RSS or Atom document into plain items.
export function parseFeed(xml, feed) {
  const doc = parser.parse(xml);
  const raw = doc?.rss?.channel?.item ?? doc?.feed?.entry ?? doc?.['rdf:RDF']?.item ?? [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list
    .map(it => ({
      source: feed.name,
      kind: feed.kind,
      title: clean(text(it.title)),
      link: safeLink(typeof it.link === 'object' ? it.link.href ?? text(it.link) : text(it.link)),
      date: new Date(text(it.pubDate) || text(it.published) || text(it.updated) || text(it['dc:date']) || 0).toISOString(),
      summary: clean(text(it.description) || text(it.summary) || text(it['content:encoded'])).slice(0, 400)
    }))
    // Daily round-up pages carry no news of their own.
    .filter(it => it.title && !/^here['\u2019]s what happened in crypto today$/i.test(it.title));
}

async function fetchFeed(feed, timeoutMs = 12000) {
  const res = await fetch(feed.url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${feed.name}: HTTP ${res.status}`);
  return parseFeed(await res.text(), feed);
}

// Read every feed now. Returns { items, missing }.
export async function fetchAll(feeds) {
  const results = await Promise.allSettled(feeds.map(f => fetchFeed(f)));
  const items = [];
  const missing = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value.length) items.push(...r.value);
    else missing.push(feeds[i].name);
  });
  return { items, missing };
}

// Keep the window, drop duplicates, newest first, coin's own news first, number them.
export function select(items, { horizon, now = Date.now() }) {
  const since = now - HOURS[horizon] * 3600 * 1000;
  const seen = new Set();
  const kept = items
    .filter(it => {
      const t = Date.parse(it.date);
      return t >= since && t <= now + 3600 * 1000;
    })
    .filter(it => {
      const key = it.title.toLowerCase().slice(0, 80);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  // Project items are rare and matter most: keep up to 10 of them, fill the rest with market news.
  const isCoin = it => it.kind === 'project' || it.kind === 'coin';
  const project = kept.filter(isCoin).slice(0, 12);
  // Take market news in turns from each source, so one busy feed cannot crowd out the others.
  const bySource = new Map();
  for (const it of kept.filter(it => !isCoin(it))) {
    if (!bySource.has(it.source)) bySource.set(it.source, []);
    bySource.get(it.source).push(it);
  }
  const market = [];
  for (let round = 0; market.length < MAX_ITEMS - project.length; round++) {
    const before = market.length;
    for (const list of bySource.values()) if (list[round] && market.length < MAX_ITEMS - project.length) market.push(list[round]);
    if (market.length === before) break;
  }
  return [...project, ...market].map((it, i) => ({ n: i + 1, ...it }));
}

// Crypto market headlines that name the coin count as news about the coin itself.
export function markCoinNews(items, coin) {
  const words = (coin.keywords ?? []).map(w => w.toLowerCase());
  return items.map(it => {
    if (it.kind !== 'crypto' || !words.length) return it;
    const text = ` ${it.title} ${it.summary} `.toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
    return words.some(w => text.includes(w)) ? { ...it, kind: 'coin' } : it;
  });
}

const feedsFor = (coin, marketFeeds) => [
  ...coin.feeds.map(f => ({ ...f, kind: 'project' })),
  ...marketFeeds
];

// Live: read the internet now. Sample: read the saved snapshot (labelled SAMPLE).
export async function collect({ coin, marketFeeds, timeframe, mode, root }) {
  const horizon = horizonOf(timeframe);
  if (mode === 'sample') {
    const snap = JSON.parse(await readFile(path.join(root, 'data/sample/snapshot.json'), 'utf8'));
    const wanted = new Set(feedsFor(coin, marketFeeds).map(f => f.name));
    const items = snap.items.filter(it => wanted.has(it.source));
    const missing = snap.missing.filter(name => wanted.has(name));
    return { horizon, items: select(items, { horizon, now: Date.parse(snap.taken_at) }), missing, sample: true };
  }
  const { items, missing } = await fetchAll(feedsFor(coin, marketFeeds));
  return { horizon, items: select(markCoinNews(items, coin), { horizon }), missing, sample: false };
}

// Save one snapshot of every feed for every coin, used by sample mode.
export async function saveSnapshot({ coins, marketFeeds, root }) {
  const all = [...new Map([...coins.flatMap(c => feedsFor(c, [])), ...marketFeeds].map(f => [f.name, f])).values()];
  const fetched = await fetchAll(all);
  const monthAgo = Date.now() - 30 * 24 * 3600 * 1000;
  const perSource = {};
  const items = fetched.items
    .filter(it => Date.parse(it.date) >= monthAgo)
    .filter(it => (perSource[it.source] = (perSource[it.source] ?? 0) + 1) <= 40);
  const missing = fetched.missing;
  const snap = { SAMPLE: 'Saved snapshot of public feeds for repeatable tests. Not live news.', taken_at: new Date().toISOString(), missing, items };
  await mkdir(path.join(root, 'data/sample'), { recursive: true });
  await writeFile(path.join(root, 'data/sample/snapshot.json'), JSON.stringify(snap, null, 2));
  return snap;
}
