// Waiting list count: how many bot subscribers asked for the paid Full version.
// Run: node scripts/waitlist.js   (reads data/bot/users.json, prints counts only, no names)
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const users = Object.values(JSON.parse(await readFile(path.join(root, 'data/bot/users.json'), 'utf8').catch(() => '{}')));
const want = users.filter(u => u.wantsFull);
console.log(`Bot subscribers: ${users.length} (from the website button: ${users.filter(u => u.source === 'site').length}), on the Full waiting list: ${want.length}`);
for (const u of want.sort((a, b) => a.wantsFull.localeCompare(b.wantsFull))) console.log(`  ${u.wantsFull.slice(0, 10)}  coins: ${u.coins.join(' ') || '-'}`);
