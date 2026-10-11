// Saves one snapshot of all feeds to data/sample/snapshot.json and prints counts per source.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { saveSnapshot } from '../server/collect.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const coins = JSON.parse(await readFile(path.join(root, 'config/coins.json'), 'utf8'));
const marketFeeds = JSON.parse(await readFile(path.join(root, 'config/feeds.json'), 'utf8'));
const snap = await saveSnapshot({ coins, marketFeeds, root });
const counts = {};
for (const it of snap.items) counts[it.source] = (counts[it.source] ?? 0) + 1;
console.log('taken_at', snap.taken_at);
console.table(counts);
console.log('missing', snap.missing);
