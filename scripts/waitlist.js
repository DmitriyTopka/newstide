// Waiting list and sources: how many bot subscribers there are, where they came from
// (the tag after ?start= in the bot link) and who asked for the paid Full version.
// Run: node scripts/waitlist.js   (reads data/bot/users.json, prints counts only, no names)
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const users = Object.values(JSON.parse(await readFile(path.join(root, 'data/bot/users.json'), 'utf8').catch(() => '{}')));
const want = users.filter(u => u.wantsFull);
console.log(`Bot subscribers: ${users.length}, on the Full waiting list: ${want.length}`);
const bySource = {};
for (const u of users) bySource[u.source ?? 'no tag'] = (bySource[u.source ?? 'no tag'] ?? 0) + 1;
console.log('By source:', Object.entries(bySource).map(([k, v]) => `${k} ${v}`).join(', ') || '-');
for (const u of want.sort((a, b) => a.wantsFull.localeCompare(b.wantsFull))) console.log(`  Full ${u.wantsFull.slice(0, 10)}  coins: ${u.coins.join(' ') || '-'}  source: ${u.source ?? '-'}`);
