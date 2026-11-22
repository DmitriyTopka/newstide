// Subscriber Store: who follows which coins, at what time. One JSON file, written atomically.
// Pure helpers (addCoins, removeCoins, newUser, ...) work on plain objects so they are easy to test.
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';

export const MAX_COINS = 10;
export const DEFAULT_TZ = 'Europe/Kyiv';

export const newUser = (lang = 'ru') => ({ coins: [], time: '08:00', tz: DEFAULT_TZ, lang, lastSent: '', last: {}, joined: new Date().toISOString() });

export function addCoins(user, symbols, known) {
  const added = [], unknown = [], skipped = [];
  for (const raw of symbols) {
    const s = raw.toUpperCase();
    if (!known.has(s)) unknown.push(s);
    else if (user.coins.includes(s)) skipped.push(s);
    else if (user.coins.length >= MAX_COINS) skipped.push(s);
    else { user.coins.push(s); added.push(s); }
  }
  return { added, unknown, skipped };
}

export function removeCoins(user, symbols) {
  const gone = symbols.map(s => s.toUpperCase()).filter(s => user.coins.includes(s));
  user.coins = user.coins.filter(s => !gone.includes(s));
  for (const s of gone) delete user.last[s];
  return gone;
}

export const validTime = t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
export const validTz = tz => { try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; } };

export async function loadUsers(file) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return {}; }
}

export async function saveUsers(file, users) {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify(users, null, 2));
  await rename(tmp, file);
}
