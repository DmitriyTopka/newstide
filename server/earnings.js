// Earnings Calendar: who reports in the next days. Nasdaq's public calendar (unofficial, no key), read once per
// date and cached for 6 hours for everybody. If it does not answer, there is simply no earnings line.
const TTL_MS = 6 * 3600e3;
const cache = new Map(); // "2026-11-24" -> { at, rows: Map(symbol -> row) }

const nyDate = ms => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));

async function day(date) {
  const hit = cache.get(date);
  if (hit && Date.now() - hit.at < (hit.rows.size ? TTL_MS : 10 * 60e3)) return hit.rows;
  let rows = new Map();
  try {
    const res = await fetch(`https://api.nasdaq.com/api/calendar/earnings?date=${date}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36', Accept: 'application/json' },
      signal: AbortSignal.timeout(8000)
    });
    if (res.ok) for (const r of (await res.json())?.data?.rows ?? []) rows.set(String(r.symbol).toUpperCase(), r);
  } catch { /* no calendar today */ }
  cache.set(date, { at: Date.now(), rows });
  return rows;
}

// The next report of one company within `days` days (today counts), or null.
// { date, offset (0 today, 1 tomorrow ...), when: 'pre' | 'post' | 'unknown', eps }
export async function nextEarnings(symbol, { now = Date.now(), days = 3 } = {}) {
  const sym = symbol.toUpperCase();
  const keys = [sym, sym.replace('-', '/'), sym.replace('-', '.')];
  for (let i = 0; i <= days; i++) {
    const date = nyDate(now + i * 86400e3);
    const rows = await day(date);
    const r = keys.map(k => rows.get(k)).find(Boolean);
    if (r) return { date, offset: i, when: r.time === 'time-pre-market' ? 'pre' : r.time === 'time-after-hours' ? 'post' : 'unknown', eps: r.epsForecast && r.epsForecast !== 'N/A' ? r.epsForecast : null };
  }
  return null;
}
