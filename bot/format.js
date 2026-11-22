// Digest Format: turns one edition into a Telegram message (HTML mode) and spots flipped verdicts.
export const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const ARROW = { up: '↑', down: '↓', sideways: '↔' };
const WORD = {
  ru: { up: 'вверх', down: 'вниз', sideways: 'в сторону', why: 'Почему', src: 'Источники', flip: 'Вердикт перевернулся', was: 'было', now: 'стало', cause: 'Новость', note: 'Спот и фьючерсы' },
  en: { up: 'up', down: 'down', sideways: 'sideways', why: 'Why', src: 'Sources', flip: 'The verdict flipped', was: 'was', now: 'now', cause: 'Story', note: 'Spot and futures' }
};

// "Flipped" means up and down swapped. A move to or from sideways is not an alarm.
export function flipped(prev, now) {
  return Boolean(prev) && ['up', 'down'].includes(prev) && ['up', 'down'].includes(now) && prev !== now;
}

export function digestMessage(coin, ed, { lang = 'ru', prev } = {}) {
  const w = WORD[lang] ?? WORD.ru;
  const ru = lang === 'ru';
  const verdict = (ru && ed.verdict_ru) || ed.verdict;
  const chain = ed.notes.chain.slice(0, 3).map(c => `• ${esc((ru && c.step_ru) || c.step)}`);
  const byN = new Map(ed.notes.dispatches.map(d => [d.n, d]));
  // The last chain steps are about the coin itself, so its sources come first.
  const cited = [...new Set([...ed.notes.chain].reverse().flatMap(c => c.cites))].slice(0, 3).map(n => byN.get(n)).filter(Boolean);
  const links = cited.map(d => `• <a href="${esc(d.link)}">${esc((ru && d.title_ru) || d.title)}</a> (${esc(d.source)})`);
  const lines = [`<b>${esc(coin.symbol)} ${ARROW[ed.direction] ?? ''} ${esc(verdict)}</b>`, `${w[ed.direction]} ${ru ? 'на ближайшие сутки' : 'for the next day'}`];
  if (flipped(prev, ed.direction)) {
    const last = ed.notes.chain.at(-1);
    const cause = last ? byN.get(last.cites[0]) : null;
    lines.push('', `⚠ <b>${w.flip}:</b> ${w.was} ${w[prev]}, ${w.now} ${w[ed.direction]}.` + (cause ? ` ${w.cause}: <a href="${esc(cause.link)}">${esc((ru && cause.title_ru) || cause.title)}</a>` : ''));
  }
  lines.push('', `<b>${w.why}</b>`, ...chain, '', `<b>${w.src}</b>`, ...links);
  return lines.join('\n');
}

// The morning summary: one line per coin, flips on top, a legend once. results: [{ sym, ed | null, prev }]
export function summaryMessage(results, { lang = 'ru', head } = {}) {
  const w = WORD[lang] ?? WORD.ru;
  const ru = lang === 'ru';
  const lines = [`<b>${esc(head)}</b>`, ''];
  for (const r of results) {
    if (!r.ed) lines.push(`· <b>${esc(r.sym)}</b> ${ru ? 'нет данных' : 'no data'}`);
    else lines.push(`${ARROW[r.ed.direction] ?? '·'} <b>${esc(r.sym)}</b> ${esc((ru && r.ed.verdict_ru) || r.ed.verdict)}`);
  }
  const flips = results.filter(r => r.ed && flipped(r.prev, r.ed.direction));
  if (flips.length) lines.push('', `⚠ <b>${w.flip}:</b> ` + flips.map(r => `${esc(r.sym)} (${w[r.prev]} → ${w[r.ed.direction]})`).join(', '));
  lines.push('', ru
    ? '<i>↑ новости тянут вверх, ↓ вниз, ↔ ясного направления нет. Оценка на ближайшие сутки по новостям за две недели. Не совет по торговле.</i>'
    : '<i>↑ the news point up, ↓ down, ↔ no clear direction. A view for the next day from two weeks of news. Not trading advice.</i>');
  return lines.join('\n');
}

// Is this user due for the daily digest right now? Pure: the clock is passed in.
export function localClock(tz, date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

export const CATCH_UP_MIN = 180; // a bot that was off at 08:00 still sends until 11:00, then skips the day

export function isDue(user, date = new Date()) {
  if (!user.coins.length) return false;
  const { date: today, minutes } = localClock(user.tz, date);
  if (user.lastSent === today) return false;
  const [h, m] = user.time.split(':').map(Number);
  const want = h * 60 + m;
  return minutes >= want && minutes - want <= CATCH_UP_MIN;
}
