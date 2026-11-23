// Digest Format: turns one edition into a Telegram message (HTML mode) and spots flipped verdicts.
import { expectedFit } from '../server/check.js';
export const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Direction icons: green chart up, red chart down, blue for no clear direction.
const ICON = { up: '🟢📈', down: '🔴📉', sideways: '🔵↔️' };
const FIT = { ru: { supports: 'за', against: 'против', mixed: 'неясно' }, en: { supports: 'for', against: 'against', mixed: 'unclear' } };
// What the verdict means for each plan: up is for Long and against Short, down the other way round.
export function planLine(direction, lang = 'ru') {
  const f = FIT[lang] ?? FIT.ru;
  return `Long: ${f[expectedFit('long', direction)]} · Short: ${f[expectedFit('short', direction)]}`;
}
export const HORIZON = {
  ru: 'Срок оценки: ближайшие сутки. Берутся только новости за последние 24 часа на момент запроса. Отдельной оценки для 4-часового и более коротких графиков нет.',
  en: 'Horizon: the next day. Only the news of the last 24 hours at the moment of the request is used. There is no separate read for the 4-hour or shorter charts.'
};
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
  const lines = [`${ICON[ed.direction] ?? ''} <b>${esc(coin.symbol)}</b> ${esc(verdict)}`, `${w[ed.direction]} ${ru ? 'в ближайшие сутки' : 'over the next day'} · ${planLine(ed.direction, lang)}`];
  if (flipped(prev, ed.direction)) {
    const last = ed.notes.chain.at(-1);
    const cause = last ? byN.get(last.cites[0]) : null;
    lines.push('', `⚠ <b>${w.flip}:</b> ${w.was} ${w[prev]}, ${w.now} ${w[ed.direction]}.` + (cause ? ` ${w.cause}: <a href="${esc(cause.link)}">${esc((ru && cause.title_ru) || cause.title)}</a>` : ''));
  }
  lines.push('', `<b>${w.why}</b>`, ...chain, '', `<b>${w.src}</b>`, ...links);
  return lines.join('\n');
}

// The morning summary: one line per coin, flips on top, a legend once. results: [{ sym, ed | null, prev }]
export function summaryMessage(results, { lang = 'ru', head, asset = 'crypto', note } = {}) {
  const w = WORD[lang] ?? WORD.ru;
  const ru = lang === 'ru';
  const lines = [`<b>${esc(head)}</b>`, ''];
  for (const r of results) {
    if (!r.ed) lines.push(`· <b>${esc(r.sym)}</b> ${ru ? 'нет данных' : 'no data'}`);
    else lines.push(`${ICON[r.ed.direction] ?? '·'} <b>${esc(r.sym)}</b> ${esc((ru && r.ed.verdict_ru) || r.ed.verdict)}\n<i>${planLine(r.ed.direction, lang)}</i>`);
  }
  const flips = results.filter(r => r.ed && flipped(r.prev, r.ed.direction));
  if (flips.length) lines.push('', `⚠ <b>${w.flip}:</b> ` + flips.map(r => `${esc(r.sym)} (${w[r.prev]} → ${w[r.ed.direction]})`).join(', '));
  if (note) lines.push('', `<i>${esc(note)}</i>`);
  const stock = asset === 'stock';
  lines.push('', ru
    ? `<i>🟢📈 новости тянут вверх, 🔴📉 вниз, 🔵↔️ ясного направления нет. Long и Short: за или против вашей идеи. ${stock ? 'Срок оценки: ближайшая торговая сессия, новости за последние 24 часа. Это акции США, не инвестиционный совет.' : HORIZON.ru + ' Это крипторынок, не совет по торговле.'}</i>`
    : `<i>🟢📈 the news point up, 🔴📉 down, 🔵↔️ no clear direction. Long and Short: for or against your idea. ${stock ? 'Horizon: the next trading session, from the news of the last 24 hours. These are US stocks, not investment advice.' : HORIZON.en + ' This is the crypto market, not trading advice.'}</i>`);
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
  if (!user.coins.length && !user.stocks?.length) return false;
  const { date: today, minutes } = localClock(user.tz, date);
  if (user.lastSent === today) return false;
  const [h, m] = user.time.split(':').map(Number);
  const want = h * 60 + m;
  return minutes >= want && minutes - want <= CATCH_UP_MIN;
}

// ---------- markets and news screens ----------
const QNAME = {
  ru: { Bitcoin: 'Биткоин', Ether: 'Эфир', 'S&P 500': 'S&P 500', Nasdaq: 'Nasdaq', 'Dow Jones': 'Доу Джонс', VIX: 'VIX (индекс страха)', 'Dollar index': 'Индекс доллара', Gold: 'Золото', Oil: 'Нефть' },
  en: { Bitcoin: 'Bitcoin', Ether: 'Ether', 'S&P 500': 'S&P 500', Nasdaq: 'Nasdaq', 'Dow Jones': 'Dow Jones', VIX: 'VIX (fear index)', 'Dollar index': 'Dollar index', Gold: 'Gold', Oil: 'Oil' }
};
const QGROUP = [['Bitcoin', 'Ether'], ['S&P 500', 'Nasdaq', 'Dow Jones'], ['VIX', 'Dollar index', 'Gold', 'Oil']];

export function quotesMessage(quotes, { lang = 'ru' } = {}) {
  const ru = lang === 'ru';
  const names = QNAME[ru ? 'ru' : 'en'];
  const heads = ru ? ['Крипто', 'Акции США', 'Страх и макро'] : ['Crypto', 'US stocks', 'Fear and macro'];
  const by = new Map(quotes.map(q => [q.name, q]));
  const out = [`<b>${ru ? 'Рынки сейчас: крипто и фондовый рынок' : 'Markets now: crypto and stocks'}</b>`];
  QGROUP.forEach((group, gi) => {
    out.push('', `<b>${heads[gi]}</b>`);
    for (const name of group) {
      const q = by.get(name);
      if (!q || q.change == null) { out.push(`⚪ ${esc(names[name])} ${ru ? 'нет данных' : 'no data'}`); continue; }
      // A rising fear index is bad news, so VIX is coloured the other way round.
      const good = name === 'VIX' ? q.change < -0.05 : q.change > 0.05;
      const bad = name === 'VIX' ? q.change > 0.05 : q.change < -0.05;
      out.push(`${good ? '🟢' : bad ? '🔴' : '🔵'} ${esc(names[name])} <b>${esc(q.value)}</b> ${q.change >= 0 ? '▲ +' : '▼ '}${q.change.toFixed(1)}%`);
    }
  });
  out.push('', ru
    ? '<i>Данные CoinGecko и Yahoo Finance (неофициальный источник), могут запаздывать. Не совет по торговле.</i>'
    : '<i>Data from CoinGecko and Yahoo Finance (unofficial source), may lag. Not trading advice.</i>');
  return out.join('\n');
}

// One company in detail: the edition card, then the price move, the official site and the market status.
export function stockDetailMessage(stock, ed, { lang = 'ru' } = {}) {
  const ru = lang === 'ru';
  const title = `${ICON[ed.direction] ?? ''} <b>${esc(stock.symbol)}</b> ${esc((ru && ed.verdict_ru) || ed.verdict)}`;
  let body;
  if (ed.quiet || !ed.notes?.chain?.length) {
    body = [title, '', ru ? 'За последние 24 часа по этой компании нет свежих новостей и раскрытий, поэтому оценку я не строю. Тихая акция всё равно может открыться гэпом из-за общего фона рынка.'
      : 'There are no fresh news or filings about this company in the last 24 hours, so there is no read. A quiet stock can still gap at the open on the market-wide news.'].join('\n');
  } else {
    body = digestMessage({ symbol: stock.symbol }, ed, { lang });
    body = body.replace(/^.*\n/, `${title}\n`);
  }
  const extra = [];
  if (ed.price) extra.push(`${ru ? 'Цена' : 'Price'}: $${esc(ed.price.value)}${ed.price.change == null ? '' : `, ${ed.price.change >= 0 ? '▲ +' : '▼ '}${ed.price.change.toFixed(1)}% ${ru ? 'за прошлую сессию' : 'in the last session'}`}`);
  if (ed.market_open === false) extra.push(ru ? 'Рынок США сейчас закрыт: оценка по новостям с прошлой сессии.' : 'The US market is closed now: the read covers the news since the last session.');
  if (stock.site) extra.push(`${ru ? 'Официальный сайт' : 'Official site'}: <a href="${esc(stock.site)}">${esc(stock.site.replace(/^https?:\/\//, ''))}</a>`);
  extra.push(`<i>${ru ? 'Не инвестиционный совет.' : 'Not investment advice.'}</i>`);
  return `${body}\n\n${extra.join('\n')}`;
}

export const STOCKS_PAGE = 25;
// The top-50 US stocks, 25 per page: colour, rank, ticker, company, price, day change.
export function stocksPage(list, { page = 0, lang = 'ru' } = {}) {
  const ru = lang === 'ru';
  const pages = Math.max(1, Math.ceil(list.length / STOCKS_PAGE));
  const out = [`<b>${ru ? 'Акции США: топ-100 по капитализации' : 'US stocks: the top 100 by market value'}</b> (${page + 1}/${pages})`, ''];
  for (const s of list.slice(page * STOCKS_PAGE, page * STOCKS_PAGE + STOCKS_PAGE)) {
    if (s.change == null) { out.push(`⚪ ${s.rank}. <b>${esc(s.symbol)}</b> ${esc(s.name)} ${ru ? 'нет данных' : 'no data'}`); continue; }
    const dot = s.change > 0.05 ? '🟢' : s.change < -0.05 ? '🔴' : '🔵';
    out.push(`${dot} ${s.rank}. <b>${esc(s.symbol)}</b> ${esc(s.name)} $${esc(s.value)} ${s.change >= 0 ? '▲ +' : '▼ '}${s.change.toFixed(1)}%`);
  }
  out.push('', ru
    ? '<i>Список составлен вручную, порядок примерный. Данные Yahoo Finance (неофициальный источник), могут запаздывать. Не совет по торговле.</i>'
    : '<i>The list is compiled by hand, the order is approximate. Data from Yahoo Finance (unofficial source), may lag. Not trading advice.</i>');
  return { text: out.join('\n'), pages };
}

export const NEWS_PAGE = 5;
const when = (iso, tz) => new Intl.DateTimeFormat('ru-RU', { timeZone: tz, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso)).replace(',', '');

// One page of the news feed: the full headline as a link to the source, the source, the time, the summary.
export function newsPage(items, { page = 0, title, lang = 'ru', tz = 'Europe/Kyiv', ruMap = new Map() } = {}) {
  const ru = lang === 'ru';
  const pages = Math.max(1, Math.ceil(items.length / NEWS_PAGE));
  const slice = items.slice(page * NEWS_PAGE, page * NEWS_PAGE + NEWS_PAGE);
  const out = [`<b>${esc(title)}</b> (${page + 1}/${pages})`, ''];
  if (!slice.length) out.push(ru ? 'Свежих новостей по этому разделу пока нет.' : 'No fresh news in this section yet.');
  for (const it of slice) {
    const head = (ru && ruMap.get(it.title)) || it.title;
    const sum = (ru && ruMap.get(it.summary)) || it.summary;
    const link = /^https?:\/\//i.test(it.link ?? '') ? `<a href="${esc(it.link)}">${esc(head)}</a>` : esc(head);
    out.push(`${it.sym ? `[${esc(it.sym)}] ` : ''}${link}`, `<i>${esc(it.source)}, ${when(it.date, tz)}</i>`);
    // search-engine summaries often just repeat the headline plus the source name: skip those
    if (sum && !sum.toLowerCase().includes(it.title.toLowerCase().slice(0, 40)) && !sum.toLowerCase().includes(head.toLowerCase().slice(0, 40))) out.push(esc(sum));
    out.push('');
  }
  return { text: out.join('\n').trim(), pages };
}
