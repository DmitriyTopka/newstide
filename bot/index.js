// Entry point: `npm run bot`. Needs TELEGRAM_BOT_TOKEN in .env (made by @BotFather).
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { telegram } from './telegram.js';
import { loadUsers, saveUsers } from './store.js';
import { createBot } from './bot.js';
import { getEdition, translateBatch } from '../server/edition.js';
import { getNews } from '../server/newsfeed.js';
import { marketQuotes } from '../server/market.js';
import { stockQuotes } from '../server/stocks.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.log('TELEGRAM_BOT_TOKEN is not set: the bot does not start. Create a bot in @BotFather and put the token in .env.');
  process.exit(0);
}
const coins = JSON.parse(await readFile(path.join(root, 'config/coins.json'), 'utf8'));
const marketFeeds = JSON.parse(await readFile(path.join(root, 'config/feeds.json'), 'utf8'));
const stockFeeds = JSON.parse(await readFile(path.join(root, 'config/stock_feeds.json'), 'utf8'));
const stocks = JSON.parse(await readFile(path.join(root, 'config/stocks.json'), 'utf8')).stocks.map(s => ({ ...s, class: 'stock' }));
const file = path.join(process.env.BOT_DATA_DIR || path.join(root, 'data/bot'), 'users.json');
const users = await loadUsers(file);
const tg = telegram(token);
const me = await tg.me();
await tg.setCommands([
  { command: 'menu', description: 'Menu / Меню' },
  { command: 'now', description: 'Edition right now / Выпуск сейчас' },
  { command: 'list', description: 'My coins / Мои монеты' },
  { command: 'news', description: 'News / Новости' },
  { command: 'markets', description: 'Markets / Рынки' },
  { command: 'about', description: 'About the bot / О боте' },
  { command: 'help', description: 'Help / Помощь' }
]);
const bot = createBot({
  tg, users, coins, stocks,
  save: u => saveUsers(file, u),
  getEdition: (coin, timeframe) => getEdition(coin, timeframe, { root, marketFeeds }),
  getStockEdition: (stock, timeframe) => getEdition(stock, timeframe, { root, marketFeeds: stockFeeds }),
  getNews: (scope, opts) => getNews(scope, { ...opts, marketFeeds, stockFeeds }),
  getQuotes: () => marketQuotes(),
  getStocks: () => stockQuotes(),
  translateTexts: texts => translateBatch(texts),
  photos: { up: path.join(root, 'public/img/bull.jpg'), down: path.join(root, 'public/img/bear.jpg'), sideways: path.join(root, 'public/img/hamster.jpg') }
});
console.log(`NewsTide bot @${me.username} is running, ${Object.keys(users).length} subscribers, ${coins.length} coins.`);

// Flip watch: every WATCH_HOURS (default 4) hours, first run one interval after start so a restart costs nothing.
const WATCH_MS = Number(process.env.WATCH_HOURS || 4) * 3600e3;
let watching = false;
setInterval(async () => {
  if (watching) return;
  watching = true;
  try { const n = await bot.watch(); if (n) console.log(`[watch] ${n} flip alert(s) sent`); }
  catch (err) { console.error('[watch]', err.message); }
  finally { watching = false; }
}, WATCH_MS);
setInterval(() => bot.tick().catch(err => console.error('[tick]', err.message)), 30000);
let offset = 0;
for (;;) {
  try {
    const updates = await tg.updates(offset);
    for (const up of updates) {
      offset = up.update_id + 1;
      if (up.message) bot.handle(up.message).catch(err => console.error('[handle]', err.message));
      if (up.callback_query) bot.handleCallback(up.callback_query).catch(err => console.error('[callback]', err.message));
    }
  } catch (err) {
    console.error('[poll]', err.message);
    await new Promise(r => setTimeout(r, 5000));
  }
}
