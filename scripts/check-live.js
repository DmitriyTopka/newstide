// Live check: reads the feeds now for every coin and horizon, prints counts per source,
// then proves the fallbacks: one broken feed is skipped, all broken feeds give no items.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collect } from '../server/collect.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const coins = JSON.parse(await readFile(path.join(root, 'config/coins.json'), 'utf8'));
const marketFeeds = JSON.parse(await readFile(path.join(root, 'config/feeds.json'), 'utf8'));

for (const coin of coins) {
  for (const timeframe of ['1h', '1d']) {
    const r = await collect({ coin, marketFeeds, timeframe, mode: 'live', root });
    const bySource = {};
    for (const it of r.items) bySource[it.source] = (bySource[it.source] ?? 0) + 1;
    console.log(`${coin.symbol} ${timeframe} (${r.horizon}): ${r.items.length} items`, JSON.stringify(bySource), r.missing.length ? `missing: ${r.missing}` : '');
  }
}

const broken = marketFeeds.map((f, i) => (i === 0 ? { ...f, url: 'https://example.invalid/rss' } : f));
const one = await collect({ coin: coins[0], marketFeeds: broken, timeframe: '1d', mode: 'live', root });
console.log('one broken feed ->', one.items.length, 'items, missing:', one.missing);

const allBroken = await collect({
  coin: { ...coins[0], feeds: [{ name: 'Broken project feed', url: 'https://example.invalid/a' }] },
  marketFeeds: marketFeeds.map(f => ({ ...f, url: 'https://example.invalid/' + f.name.length })),
  timeframe: '1d', mode: 'live', root
});
console.log('all feeds broken ->', allBroken.items.length, 'items, missing:', allBroken.missing.length);
