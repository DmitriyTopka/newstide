import test from 'node:test';
import assert from 'node:assert/strict';
import { addCoins, removeCoins, newUser, validTime, validTz, MAX_COINS } from '../bot/store.js';
import { flipped, digestMessage, isDue, localClock } from '../bot/format.js';
import { createBot } from '../bot/bot.js';

const known = new Set(['BTC', 'ETH', 'XRP', 'SOL']);
const coins = [...known].map(symbol => ({ symbol, name: symbol, group: symbol === 'SOL' ? 'l1' : 'top' }));
const edition = (direction = 'up') => ({
  direction, verdict: 'Growth for XRP', verdict_ru: 'Рост для XRP',
  notes: {
    chain: [{ step: 'Macro is calm.', step_ru: 'Макро спокойно.', cites: [1] }, { step: 'XRP news is good.', step_ru: 'Новости XRP хорошие.', cites: [2] }],
    dispatches: [
      { n: 1, title: 'Fed holds', title_ru: 'ФРС держит ставку', source: 'Federal Reserve', link: 'https://example.com/1' },
      { n: 2, title: 'XRP <upgrade>', source: 'XRPL', link: 'https://example.com/2' }
    ]
  }
});

test('addCoins: adds known, reports unknown, skips duplicates and respects the limit', () => {
  const u = newUser();
  const r = addCoins(u, ['btc', 'DOGEX', 'BTC', 'eth'], known);
  assert.deepEqual(r.added, ['BTC', 'ETH']);
  assert.deepEqual(r.unknown, ['DOGEX']);
  assert.deepEqual(r.skipped, ['BTC']);
  const big = new Set(Array.from({ length: 20 }, (_, i) => `C${i}`));
  const v = newUser();
  addCoins(v, [...big], big);
  assert.equal(v.coins.length, MAX_COINS);
});

test('removeCoins forgets the last verdict too', () => {
  const u = newUser();
  addCoins(u, ['BTC', 'ETH'], known);
  u.last.BTC = { direction: 'up' };
  assert.deepEqual(removeCoins(u, ['btc', 'SOL']), ['BTC']);
  assert.deepEqual(u.coins, ['ETH']);
  assert.equal(u.last.BTC, undefined);
});

test('time and time zone validation', () => {
  assert.ok(validTime('08:00') && validTime('23:59'));
  assert.ok(!validTime('8:00') && !validTime('24:00') && !validTime('ab'));
  assert.ok(validTz('Europe/Kyiv') && !validTz('Mars/Base'));
});

test('flipped only for up <-> down', () => {
  assert.ok(flipped('up', 'down') && flipped('down', 'up'));
  assert.ok(!flipped('up', 'sideways') && !flipped('sideways', 'down') && !flipped(undefined, 'up') && !flipped('up', 'up'));
});

test('digestMessage: Russian text, escaped HTML, links, flip note', () => {
  const msg = digestMessage({ symbol: 'XRP' }, edition('down'), { lang: 'ru', prev: 'up' });
  assert.match(msg, /Рост для XRP/);
  assert.match(msg, /Макро спокойно/);
  assert.match(msg, /href="https:\/\/example.com\/1"/);
  assert.match(msg, /XRP &lt;upgrade&gt;/);
  assert.match(msg, /Вердикт перевернулся/);
  assert.doesNotMatch(digestMessage({ symbol: 'XRP' }, edition('down'), { lang: 'ru', prev: 'down' }), /перевернулся/);
  assert.match(digestMessage({ symbol: 'XRP' }, edition('up'), { lang: 'en' }), /Why/);
});

test('isDue: at the time, in the catch-up window, once a day, in the user zone', () => {
  const u = newUser();
  u.coins = ['BTC'];
  // 08:00 in Kyiv in winter is 06:00 UTC
  assert.equal(isDue(u, new Date('2026-11-22T05:59:00Z')), false);
  assert.equal(isDue(u, new Date('2026-11-22T06:00:00Z')), true);
  assert.equal(isDue(u, new Date('2026-11-22T08:30:00Z')), true);
  assert.equal(isDue(u, new Date('2026-11-22T09:30:00Z')), false); // past the 3 hour window
  u.lastSent = localClock(u.tz, new Date('2026-11-22T06:00:00Z')).date;
  assert.equal(isDue(u, new Date('2026-11-22T06:05:00Z')), false);
  u.coins = [];
  u.lastSent = '';
  assert.equal(isDue(u, new Date('2026-11-22T06:00:00Z')), false);
});

function harness(over = {}) {
  const sent = [];
  const photosSent = [];
  const acks = [];
  const users = {};
  let clock = new Date('2026-11-22T06:00:00Z');
  const calls = { editions: 0 };
  const bot = createBot({
    tg: {
      send: async (id, text, markup) => { sent.push({ id, text, markup }); },
      edit: async (id, mid, text, markup) => { sent.push({ id, text, markup, edited: mid }); },
      answer: async (cbId, text) => { acks.push({ cbId, text }); },
      sendPhoto: async (id, photo, caption) => { photosSent.push({ id, photo, caption }); return { photo: [{ file_id: 'FILE123' }] }; }
    },
    photos: { up: '/img/bull.jpg', down: '/img/bear.jpg', sideways: '/img/hamster.jpg' },
    getNews: async scope => Array.from({ length: 7 }, (_, i) => ({ title: `Headline ${scope} ${i}`, summary: `Summary ${i}`, link: `https://example.com/${i}`, source: 'Src', date: '2026-11-22T10:00:00Z', ...(scope === 'mine' ? { sym: 'XRP' } : {}) })),
    getStocks: async () => Array.from({ length: 50 }, (_, i) => ({ rank: i + 1, symbol: `S${i + 1}`, name: `Company ${i + 1}`, value: '100.0', change: i === 3 ? null : (i % 2 ? -1.5 : 2.5) })),
    getQuotes: async () => [{ name: 'Bitcoin', value: '$60,000', change: 1.2 }, { name: 'S&P 500', value: '6,900', change: -3.7 }, { name: 'VIX', value: '35.9', change: 26.2 }, { name: 'Gold', value: 'x', change: null }],
    translateTexts: async texts => new Map(texts.map(t => [t, `RU ${t}`])),
    users, coins, save: async () => {},
    getEdition: async () => { calls.editions++; if (over.fail) throw Object.assign(new Error('x'), { reason: over.fail }); return edition(over.direction ?? 'up'); },
    now: () => clock, log: { error() {} }
  });
  return { bot, sent, acks, photosSent, users, calls, setClock: d => { clock = d; } };
}
const msg = (text, id = 7) => ({ chat: { id, type: 'private' }, text, from: { language_code: 'ru' } });

test('commands: start, add, list, time, lang', async () => {
  const h = harness();
  await h.bot.handle(msg('/start'));
  await h.bot.handle(msg('/add xrp btc fake'));
  assert.deepEqual(h.users['7'].coins, ['XRP', 'BTC']);
  assert.match(h.sent.at(-1).text, /Добавлено: XRP, BTC/);
  assert.match(h.sent.at(-1).text, /Не знаю таких монет: FAKE/);
  await h.bot.handle(msg('/time 25:00'));
  assert.match(h.sent.at(-1).text, /Другое время: \/time/);
  await h.bot.handle(msg('/time 09:30'));
  assert.equal(h.users['7'].time, '09:30');
  await h.bot.handle(msg('/lang en'));
  assert.equal(h.users['7'].lang, 'en');
});

test('/now prints one summary with a details button per coin and remembers the direction', async () => {
  const h = harness();
  await h.bot.handle(msg('/start'));
  await h.bot.handle(msg('/add XRP'));
  h.sent.length = 0;
  await h.bot.handle(msg('/now'));
  const summary = h.sent.find(s => /сводка за/.test(s.text));
  assert.ok(summary && /Рост для XRP/.test(summary.text));
  assert.equal(h.sent.filter(s => /сводка за/.test(s.text)).length, 1);
  assert.ok(summary.markup.inline_keyboard.flat().some(b => b.callback_data === 'm:XRP'));
  assert.equal(h.users['7'].last.XRP.direction, 'up');
});

test('tick sends the digest once a day and flags a flip', async () => {
  const h = harness({ direction: 'down' });
  await h.bot.handle(msg('/start'));
  await h.bot.handle(msg('/add XRP'));
  h.users['7'].last.XRP = { direction: 'up' };
  h.sent.length = 0;
  await h.bot.tick();
  const first = h.sent.length;
  assert.equal(first, 1);
  assert.ok(h.sent.some(s => /перевернулся/.test(s.text)));
  await h.bot.tick();
  assert.equal(h.sent.length, first);
});

test('a failed print is reported to the user, not thrown', async () => {
  const h = harness({ fail: 'limit' });
  await h.bot.handle(msg('/start'));
  await h.bot.handle(msg('/add XRP'));
  h.sent.length = 0;
  await h.bot.handle(msg('/now'));
  assert.ok(h.sent.some(s => /лимит расходов/.test(s.text)));
});

test('group chats and /stop', async () => {
  const h = harness();
  await h.bot.handle({ chat: { id: 1, type: 'group' }, text: '/start' });
  assert.equal(h.sent.length, 0);
  await h.bot.handle(msg('/start'));
  await h.bot.handle(msg('/stop'));
  assert.ok(h.users['7'], 'asks first, deletes nothing yet');
  assert.ok(h.sent.at(-1).markup.inline_keyboard.flat().some(b => b.callback_data === 'stopyes'));
  await h.bot.handleCallback({ id: 'y', data: 'stopyes', from: {}, message: { message_id: 1, chat: { id: 7, type: 'private' } } });
  assert.equal(h.users['7'], undefined);
});

test('waiting list: /full and /start full record interest once, no price promised', async () => {
  const h = harness();
  await h.bot.handle(msg('/start'));
  assert.equal(h.users['7'].wantsFull, undefined);
  await h.bot.handle(msg('/full'));
  const first = h.users['7'].wantsFull;
  assert.ok(first);
  assert.match(h.sent.at(-1).text, /лист ожидания/);
  await h.bot.handle(msg('/full'));
  assert.equal(h.users['7'].wantsFull, first);
  assert.match(h.sent.at(-1).text, /уже в листе/);
  await h.bot.handle(msg('/start full', 9));
  assert.ok(h.users['9'].wantsFull);
  assert.match(h.sent.at(-1).text, /лист ожидания/);
});

const press = (data, id = 7, mid = 100) => ({ id: `cb${Math.random()}`, data, from: { language_code: 'ru' }, message: { message_id: mid, chat: { id, type: 'private' } } });

test('buttons: pick coins from the grid, switch groups, done, limit', async () => {
  const h = harness();
  await h.bot.handle(msg('/start'));
  assert.ok(h.sent.at(-1).markup.inline_keyboard.flat().some(b => b.callback_data === 'pick'));
  await h.bot.handleCallback(press('pick'));
  assert.equal(h.sent.at(-1).edited, 100);
  await h.bot.handleCallback(press('c:BTC:top'));
  await h.bot.handleCallback(press('pg:l1'));
  await h.bot.handleCallback(press('c:SOL:l1'));
  assert.deepEqual(h.users['7'].coins, ['BTC', 'SOL']);
  const buttons = h.sent.at(-1).markup.inline_keyboard.flat();
  assert.ok(buttons.some(b => b.text === '✅ SOL'));
  await h.bot.handleCallback(press('c:BTC:top'));
  assert.deepEqual(h.users['7'].coins, ['SOL']);
  await h.bot.handleCallback(press('pdone'));
  assert.match(h.sent.at(-1).text, /Выпуск сейчас/);
  assert.ok(h.acks.length >= 5);
});

test('buttons: the coin limit is explained, not silently ignored', async () => {
  const h = harness();
  await h.bot.handle(msg('/start'));
  h.users['7'].coins = Array.from({ length: 10 }, (_, i) => `X${i}`);
  await h.bot.handleCallback(press('c:BTC:top'));
  assert.ok(!h.users['7'].coins.includes('BTC'));
  assert.match(h.acks.at(-1).text, /Лимит/);
});

test('buttons: quick start, time, zone, language, details, stop', async () => {
  const h = harness();
  await h.bot.handle(msg('/start'));
  await h.bot.handleCallback(press('q'));
  assert.deepEqual(h.users['7'].coins, ['BTC', 'SOL', 'ETH'].filter(c => known.has(c)).sort((a, b) => ['BTC', 'ETH', 'SOL'].indexOf(a) - ['BTC', 'ETH', 'SOL'].indexOf(b)));
  await h.bot.handleCallback(press('t:07:00'));
  assert.equal(h.users['7'].time, '07:00');
  await h.bot.handleCallback(press('z:1'));
  assert.equal(h.users['7'].tz, 'Europe/Warsaw');
  await h.bot.handleCallback(press('l:en'));
  assert.equal(h.users['7'].lang, 'en');
  await h.bot.handleCallback(press('now'));
  await h.bot.handleCallback(press('m:BTC'));
  assert.match(h.sent.at(-1).text, /Why/);
  await h.bot.handleCallback(press('stop'));
  assert.ok(h.users['7']);
  await h.bot.handleCallback(press('stopyes'));
  assert.equal(h.users['7'], undefined);
});

test('buttons: ignore group chats and unknown data', async () => {
  const h = harness();
  await h.bot.handleCallback({ id: 'x', data: 'pick', from: {}, message: { message_id: 1, chat: { id: 5, type: 'group' } } });
  assert.equal(h.sent.length, 0);
  await h.bot.handle(msg('/start'));
  const n = h.sent.length;
  await h.bot.handleCallback(press('zzz:1'));
  await h.bot.handleCallback(press('z:99'));
  assert.equal(h.sent.length, n);
});

test('every callback_data fits Telegram limit of 64 bytes', async () => {
  const h = harness();
  await h.bot.handle(msg('/start'));
  for (const d of ['pick', 'pg:meme', 'set', 'tm', 'tzp', 'lg', 'help', 'stop', 'menu']) await h.bot.handleCallback(press(d));
  for (const s of h.sent) for (const b of s.markup?.inline_keyboard.flat() ?? []) assert.ok(Buffer.byteLength(b.callback_data) <= 64, b.callback_data);
});

test('watch: a flip up<->down is pushed at once with a cooldown, quiet hours, an off switch', async () => {
  const h = harness({ direction: 'down' });
  await h.bot.handle(msg('/start'));
  await h.bot.handle(msg('/add XRP'));
  const u = h.users['7'];
  h.sent.length = 0;
  assert.equal(await h.bot.watch(), 0, 'nothing seen yet, no alert');
  u.last.XRP = { direction: 'sideways' };
  assert.equal(await h.bot.watch(), 0, 'sideways -> down is not an alarm');
  u.last.XRP = { direction: 'up' };
  h.setClock(new Date('2026-11-22T21:30:00Z')); // 23:30 in Kyiv
  assert.equal(await h.bot.watch(), 0, 'quiet hours, left for the morning summary');
  h.setClock(new Date('2026-11-22T10:00:00Z'));
  assert.equal(await h.bot.watch(), 1);
  assert.match(h.sent.at(-1).text, /Развернулся вердикт: XRP/);
  assert.match(h.sent.at(-1).text, /перевернулся/);
  assert.equal(u.last.XRP.direction, 'down');
  u.last.XRP = { direction: 'up' };
  assert.equal(await h.bot.watch(), 0, 'cooldown: once per 6 hours');
  h.setClock(new Date('2026-11-22T17:00:00Z'));
  u.alerts = false;
  assert.equal(await h.bot.watch(), 0, 'alerts off');
});

test('watch: off switch in settings and in the alert itself', async () => {
  const h = harness();
  await h.bot.handle(msg('/start'));
  await h.bot.handleCallback(press('set'));
  assert.ok(h.sent.at(-1).markup.inline_keyboard.flat().some(b => b.callback_data === 'al'));
  await h.bot.handleCallback(press('al'));
  assert.equal(h.users['7'].alerts, false);
  await h.bot.handleCallback(press('al'));
  assert.equal(h.users['7'].alerts, true);
  await h.bot.handleCallback(press('aloff'));
  assert.equal(h.users['7'].alerts, false);
});

test('watch: stops quietly when the daily limit is reached', async () => {
  const h = harness({ fail: 'limit' });
  await h.bot.handle(msg('/start'));
  await h.bot.handle(msg('/add XRP BTC'));
  assert.equal(await h.bot.watch(), 0);
  assert.equal(h.calls.editions, 1, 'it does not keep hammering the printer after the limit');
});

test('about screens: overview, read, sources, privacy with a delete button, all within Telegram limits', async () => {
  const h = harness();
  await h.bot.handle(msg('/start'));
  await h.bot.handle(msg('/about'));
  assert.match(h.sent.at(-1).text, /Чего он не делает/);
  for (const part of ['read', 'src', 'priv']) {
    await h.bot.handleCallback(press(`ab:${part}`));
    assert.ok(h.sent.at(-1).text.length < 4000);
  }
  assert.match(h.sent.at(-1).text, /Приватность/);
  assert.ok(h.sent.at(-1).markup.inline_keyboard.flat().some(b => b.callback_data === 'stop'));
  await h.bot.handleCallback(press('about'));
  await h.bot.handleCallback(press('l:en'));
  await h.bot.handleCallback(press('about'));
  assert.match(h.sent.at(-1).text, /What it does not do/);
});

import { readFile } from 'node:fs/promises';
test('market feeds: geopolitics sources are present and every kind is one the printer knows', async () => {
  const feeds = JSON.parse(await readFile(new URL('../config/feeds.json', import.meta.url), 'utf8'));
  assert.ok(feeds.filter(f => f.kind === 'geo').length >= 3);
  for (const f of feeds) assert.ok(['crypto', 'macro', 'geo'].includes(f.kind), f.name);
});

test('summary: coloured icons, Long/Short lines, horizon note, crypto marker, a woodcut first', async () => {
  const h = harness({ direction: 'up' });
  await h.bot.handle(msg('/start'));
  await h.bot.handle(msg('/add XRP'));
  h.sent.length = 0;
  await h.bot.handle(msg('/now'));
  const summary = h.sent.find(s => /крипто-сводка/.test(s.text));
  assert.ok(summary.text.includes('🟢📈'));
  assert.match(summary.text, /Long: за · Short: против/);
  assert.match(summary.text, /ближайшие сутки.*последние 24 часа/);
  assert.match(summary.text, /Это крипторынок/);
  assert.equal(h.photosSent.length, 1);
  assert.equal(h.photosSent[0].photo, '/img/bull.jpg');
  const down = harness({ direction: 'down' });
  await down.bot.handle(msg('/start'));
  await down.bot.handle(msg('/add XRP'));
  await down.bot.handle(msg('/now'));
  assert.equal(down.photosSent[0].photo, '/img/bear.jpg');
  assert.ok(down.sent.some(s => s.text.includes('🔴📉') && /Long: против · Short: за/.test(s.text)));
});

test('markets screen: crypto, US stocks and macro with colours, VIX inverted', async () => {
  const h = harness();
  await h.bot.handle(msg('/start'));
  await h.bot.handleCallback(press('mk'));
  const text = h.sent.at(-1).text;
  assert.match(text, /крипто и фондовый рынок/);
  assert.match(text, /🟢 Биткоин/);
  assert.match(text, /🔴 S&amp;P 500|🔴 S&P 500/);
  assert.match(text, /🔴 VIX/, 'a rising fear index is red');
  assert.match(text, /⚪ Золото нет данных/);
});

test('news: sections, paging, links to sources, Russian titles, empty coin list', async () => {
  const h = harness();
  await h.bot.handle(msg('/start'));
  await h.bot.handleCallback(press('nw:mine:0'));
  assert.match(h.sent.at(-1).text, /Сначала выберите монеты/);
  await h.bot.handle(msg('/add XRP'));
  await h.bot.handle(msg('/news'));
  assert.ok(h.sent.at(-1).markup.inline_keyboard.flat().some(b => b.callback_data === 'nw:world:0'));
  await h.bot.handleCallback(press('nw:mine:0'));
  let m = h.sent.at(-1);
  assert.match(m.text, /Новости по вашим монетам<\/b> \(1\/2\)/);
  assert.match(m.text, /\[XRP\] <a href="https:\/\/example.com\/0">RU Headline mine 0<\/a>/);
  assert.match(m.text, /RU Summary 0/);
  assert.ok(m.markup.inline_keyboard.flat().some(b => b.callback_data === 'nw:mine:1'));
  await h.bot.handleCallback(press('nw:mine:1'));
  m = h.sent.at(-1);
  assert.match(m.text, /\(2\/2\)/);
  assert.ok(m.markup.inline_keyboard.flat().some(b => b.callback_data === 'nw:mine:0'));
  assert.ok(!m.markup.inline_keyboard.flat().some(b => b.callback_data === 'nw:mine:2'));
  await h.bot.handleCallback(press('l:en'));
  await h.bot.handleCallback(press('nw:world:0'));
  assert.match(h.sent.at(-1).text, /Headline world 0/);
  assert.ok(!/RU Headline/.test(h.sent.at(-1).text));
  assert.ok(Buffer.byteLength(h.sent.at(-1).text) < 4096);
});

import { parseFeed } from '../server/collect.js';
test('sport pages are dropped from feeds', () => {
  const xml = '<rss><channel><item><title>Match report</title><link>https://example.com/sports/2026/1</link><pubDate>Sun, 22 Nov 2026 10:00:00 GMT</pubDate></item><item><title>Strike on port</title><link>https://example.com/news/2026/2</link><pubDate>Sun, 22 Nov 2026 10:00:00 GMT</pubDate></item></channel></rss>';
  assert.deepEqual(parseFeed(xml, { name: 'X', kind: 'geo' }).map(i => i.title), ['Strike on port']);
});

test('stocks: top 50 US stocks in two pages with colours and no data marks', async () => {
  const h = harness();
  await h.bot.handle(msg('/start'));
  await h.bot.handleCallback(press('mk'));
  assert.ok(h.sent.at(-1).markup.inline_keyboard.flat().some(b => b.callback_data === 'st:0'));
  await h.bot.handleCallback(press('st:0'));
  let m = h.sent.at(-1);
  assert.match(m.text, /Акции США: топ-50.*\(1\/2\)/);
  assert.match(m.text, /🟢 1\. <b>S1<\/b> Company 1 \$100.0 ▲ \+2.5%/);
  assert.match(m.text, /🔴 2\. <b>S2<\/b>/);
  assert.match(m.text, /⚪ 4\. <b>S4<\/b>.*нет данных/);
  assert.ok(Buffer.byteLength(m.text) < 4096);
  assert.ok(m.markup.inline_keyboard.flat().some(b => b.callback_data === 'st:1'));
  await h.bot.handleCallback(press('st:1'));
  m = h.sent.at(-1);
  assert.match(m.text, /\(2\/2\)/);
  assert.match(m.text, /26\. <b>S26<\/b>/);
  assert.ok(!m.markup.inline_keyboard.flat().some(b => b.callback_data === 'st:2'));
  await h.bot.handle(msg('/stocks'));
  assert.match(h.sent.at(-1).text, /\(1\/2\)/);
});

import { translateBatch } from '../server/edition.js';
test('security: the buttons that fetch are rate limited per chat', async () => {
  const h = harness();
  await h.bot.handle(msg('/start'));
  for (let i = 0; i < 9; i++) await h.bot.handleCallback(press('mk', 11));
  assert.match(h.acks.at(-1).text, /Не так быстро/);
  await h.bot.handleCallback(press('mk', 12));
  assert.match(h.acks.at(-1).text, /Загружаю рынки/, 'another chat is not affected');
});

test('security: news translations have their own small budget', async () => {
  let calls = 0;
  const big = { translate: async texts => { calls++; return { ru: new Map(texts.map(t => [t, `RU ${t}`])), usage: { input_tokens: 5e7, output_tokens: 0 }, model: 'claude-haiku-5-5' }; } };
  assert.equal((await translateBatch(['one'], { deps: big })).get('one'), 'RU one');
  assert.equal((await translateBatch(['two'], { deps: big })).size, 0, 'sub-budget spent: English stays');
  assert.equal(calls, 1);
});

test('source tags: the first plain tag after /start is kept, odd ones are not', async () => {
  const h = harness();
  await h.bot.handle(msg('/start chat', 21));
  assert.equal(h.users['21'].source, 'chat');
  await h.bot.handle(msg('/start friends', 21));
  assert.equal(h.users['21'].source, 'chat', 'the first tag stays');
  await h.bot.handle(msg('/start Site', 22));
  assert.equal(h.users['22'].source, 'site', 'tags are lower-cased');
  await h.bot.handle(msg('/start <script>alert(1)</script>', 23));
  assert.equal(h.users['23'].source, undefined);
  await h.bot.handle(msg('/start ' + 'x'.repeat(40), 24));
  assert.equal(h.users['24'].source, undefined);
  await h.bot.handle(msg('/start full', 25));
  assert.equal(h.users['25'].source, undefined, 'full is the waiting list, not a source');
  assert.ok(h.users['25'].wantsFull);
});
