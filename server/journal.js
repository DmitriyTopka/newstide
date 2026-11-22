// Verdict Journal: every printed verdict is saved with the coin's price at that moment,
// so scripts/score.js can later compare it with the price 4 hours or 1 day on.
// One line per verdict in data/journal/verdicts.jsonl (set JOURNAL_DIR to move it).
// On a read-only host (Vercel) the write fails quietly and the page still works.
import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) NewsTide/0.1';

export const journalDir = root => process.env.JOURNAL_DIR || path.join(root, 'data/journal');

export async function priceNow(coin) {
  if (!coin.coingecko) return null;
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coin.coingecko)}&vs_currencies=usd`;
    const d = await (await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) })).json();
    return d?.[coin.coingecko]?.usd ?? null;
  } catch {
    return null;
  }
}

// Fire and forget: the caller does not wait and never sees an error.
export function recordVerdict(root, { coin, plan, timeframe, direction, verdict, model }) {
  (async () => {
    const entry = {
      at: new Date().toISOString(),
      coin: coin.symbol,
      coingecko: coin.coingecko ?? null,
      timeframe,
      plan,
      direction,
      verdict,
      model,
      price_usd: await priceNow(coin)
    };
    const dir = journalDir(root);
    await mkdir(dir, { recursive: true });
    await appendFile(path.join(dir, 'verdicts.jsonl'), JSON.stringify(entry) + '\n');
  })().catch(err => console.error('[journal]', err.message));
}
