// NewsTide Bot: buttons first, commands as a fallback. Daily summary with "details" buttons and flip notes.
// Everything outside (Telegram, the printer, the clock, the disk) is passed in, so the whole thing
// can be tested without a token.
import { addCoins, removeCoins, addStocks, removeStocks, resolveStock, newUser, validTime, validTz, MAX_COINS, MAX_STOCKS } from './store.js';
import { digestMessage, summaryMessage, quotesMessage, newsPage, NEWS_PAGE, stocksPage, stockDetailMessage, flipped, isDue, localClock, esc } from './format.js';

// Flip alerts: never at night (the morning summary carries the flip), and not more than once per coin per 6 hours.
const QUIET_FROM = 23 * 60, QUIET_TO = 7 * 60, ALERT_COOLDOWN_MS = 6 * 3600e3;

const QUICK_START = ['BTC', 'ETH', 'SOL'];
const TIMES = ['06:00', '07:00', '08:00', '09:00', '10:00', '12:00', '18:00', '21:00'];
const TZS = [
  ['Europe/Kyiv', 'Киев', 'Kyiv'], ['Europe/Warsaw', 'Варшава', 'Warsaw'], ['Europe/Prague', 'Прага', 'Prague'], ['Europe/London', 'Лондон', 'London'],
  ['America/New_York', 'Нью-Йорк', 'New York'], ['Asia/Dubai', 'Дубай', 'Dubai'], ['Europe/Istanbul', 'Стамбул', 'Istanbul'], ['Asia/Singapore', 'Сингапур', 'Singapore']
];
const SGROUPS = [['tech', 'Технологии', 'Tech'], ['finance', 'Финансы', 'Finance'], ['health', 'Здоровье', 'Health'], ['consumer', 'Потребление', 'Consumer'], ['energy', 'Энергия', 'Energy'], ['industrial', 'Промышленность', 'Industrial'], ['crypto', 'Крипто-связь', 'Crypto-linked']];
const GROUPS = [['top', 'Основные', 'Top'], ['l1', 'L1', 'L1'], ['l2', 'L2', 'L2'], ['defi', 'DeFi', 'DeFi'], ['meme', 'Мемы', 'Memes']];

const T = {
  ru: {
    welcome: `<b>NewsTide</b>: новостной фон по вашим монетам.\n\nВыберите до ${MAX_COINS} монет, и каждое утро я пришлю одну короткую сводку: куда сейчас тянут новости, ↑ вверх, ↓ вниз или ↔ ясного направления нет. Если направление развернулось, напишу сразу, не дожидаясь утра.\n\nЭто не прогноз цены и не совет по торговле: я читаю новости и показываю, на что они похожи. Пример сводки можно посмотреть кнопкой ниже.`,
    pickCoins: 'Выбрать монеты', quick: `Быстрый старт: ${QUICK_START.join(' ')}`, example: 'Пример сводки',
    exampleTitle: 'Пример сводки (данные ненастоящие)',
    exampleBody: ['🟢📈 <b>BTC</b> Рост ожидается', '<i>Long: за · Short: против</i>', '🔵↔️ <b>ETH</b> Пока без ясного направления', '<i>Long: неясно · Short: неясно</i>', '🔴📉 <b>SOL</b> Риск коррекции', '<i>Long: против · Short: за</i>', '', '⚠ <b>Вердикт перевернулся:</b> SOL (вверх → вниз)', '', '<i>🟢📈 новости тянут вверх, 🔴📉 вниз, 🔵↔️ ясного направления нет. Срок оценки: ближайшие сутки, по новостям за последние 24 часа. Это крипторынок, не совет по торговле.</i>', '', 'Под сводкой будут кнопки монет: нажмёте, и придут причины и ссылки на новости.'],
    menuHead: 'Меню', noCoins: 'Монет пока нет.', yourCoins: c => `Ваши монеты: ${c.join(', ')}`,
    schedule: (t, tz) => `Сводка приходит в ${t} (${tz}).`,
    bNow: 'Выпуск сейчас', bCoins: 'Мои монеты', bSettings: 'Настройки', bFull: 'Версия Full', bHelp: 'Помощь', bBack: 'Назад', bDone: n => `Готово (${n})`,
    pickHead: n => `Выберите монеты, до ${MAX_COINS}. Выбрано: ${n}.`, pickHint: 'Нужной монеты нет в списке? Напишите её тикер командой /add.',
    pickedNote: 'Готово. Нажмите «Выпуск сейчас», чтобы увидеть первую сводку.', quickNote: c => `Добавил ${c.join(', ')}. Нажмите «Выпуск сейчас», чтобы увидеть первую сводку.`,
    limitReached: `Лимит ${MAX_COINS} монет. Уберите что-нибудь.`, empty: 'Сначала выберите монеты.',
    bStocks: 'Таблица цен: топ-100', stocksFail: 'Не удалось получить котировки акций, попробуйте позже.', stocksLoading: 'Загружаю акции...',
    slowdown: 'Не так быстро, подождите несколько секунд.',
    bStk: 'Акции США', stkHead: 'Акции США', stkMine: s => `Ваши акции: ${s.join(', ')}`, stkNone: 'Акций пока нет.',
    stkDesc: 'Сводка по акциям приходит вместе с утренней сводкой по монетам. Берутся раскрытия SEC (форма 8-K), заголовки о компании и рыночные новости за последние 24 часа. Не инвестиционный совет.',
    bPickStocks: 'Выбрать акции', bStockNow: 'Сводка по акциям', bStockNews: 'Новости по акциям', bStockTable: 'Таблица цен: топ-100',
    stockPickHead: n => `Выберите акции, до ${MAX_STOCKS}. Выбрано: ${n}.`, stockPickHint: 'Нужной нет во вкладках? Напишите /add Apple или /add AAPL: работают тикер, название и название по-русски.',
    stockMoreHint: 'Нажмите на компанию, чтобы увидеть причины, цену и ссылки.',
    stockPicked: 'Готово. Нажмите «Сводка по акциям», чтобы увидеть первую.', stockLimit: `Лимит ${MAX_STOCKS} акций. Уберите что-нибудь.`, stockEmpty: 'Сначала выберите акции.',
    stockAdded: a => `Акции добавлены: ${a.join(', ')}.`, stockHead: d => `NewsTide: акции США за ${d}`,
    stockClosed: 'Рынок США сейчас закрыт: оценка по новостям с прошлой сессии, ход может случиться на открытии.',
    newsStocks: 'Мои акции', newsMarket: 'Фондовый рынок', newsNoStocks: 'Сначала выберите акции, тогда покажу новости по ним.',
    bNews: 'Новости', bMarkets: 'Рынки', newsHead: 'Новости: что показать?', newsMine: 'Мои монеты', newsCrypto: 'Крипторынок', newsWorld: 'Мир и макро (войны, ФРС)',
    newsTitles: { mine: 'Новости по вашим монетам', crypto: 'Новости крипторынка', world: 'Мировые новости и макро', stocks: 'Новости по вашим акциям', market: 'Новости фондового рынка' }, newsMore: 'Ещё ›', newsPrev: '‹ Назад', newsSections: 'Разделы', newsLoading: 'Загружаю новости...',
    newsHint: 'Заголовки ведут на сайты источников. Полный текст читайте там.', newsNoCoins: 'Сначала выберите монеты, тогда покажу новости по ним.', marketsLoading: 'Загружаю рынки...', marketsFail: 'Не удалось получить котировки, попробуйте позже.',
    moodUp: 'Бык: новости по вашим монетам в основном тянут вверх', moodDown: 'Медведь: новости по вашим монетам в основном тянут вниз', moodFlat: 'Хомяк: ясного направления нет',
    bAbout: 'О боте', bRead: 'Как читать сводку', bSources: 'Откуда новости', bPriv: 'Приватность', bDelete: 'Удалить мои данные',
    aboutText: '<b>О боте</b>\nNewsTide читает новости и показывает, куда они сейчас тянут вашу монету или акцию США из топ-100. Вы выбираете монеты (до ' + MAX_COINS + '), бот каждое утро присылает одну короткую сводку и сам пишет, если вердикт развернулся.\n\n<b>Что он делает.</b> Читает блоги и форумы проектов, релизы разработчиков, крупные крипто-СМИ и макро-новости. Модель сводит это в один вердикт на монету, со ссылками на новости, на которых он стоит.\n\n<b>Чего он не делает.</b> Не предсказывает цену, не даёт торговых советов, не знает будущего.',
    readText: '<b>Как читать сводку</b>\n🟢📈 новости тянут вверх\n🔴📉 новости тянут вниз\n🔵↔️ ясного направления нет: тихо или новости спорят друг с другом\n\n<b>Long и Short</b> показывают, что это значит для вашей идеи: покупаете (Long) или продаёте в шорт (Short), новостной фон за вас, против вас или неясен.\n\n<b>Срок:</b> ближайшие сутки. Берутся только новости за последние 24 часа на момент запроса. Отдельной оценки для 4-часового и более коротких графиков нет.\n\nКнопка с монетой под сводкой открывает причины по шагам и ссылки на новости.\n\n⚠ <b>Вердикт перевернулся</b> значит, что было вверх, а стало вниз (или наоборот). Это пришлю сразу, днём. Ночью не беспокою, тогда переворот будет в утренней сводке.',
    srcText: '<b>Откуда новости</b>\nПо каждой монете: блог и форум проекта, релизы разработчиков на GitHub и поиск новостей про неё. По акциям: раскрытия SEC (форма 8-K) и заголовки Yahoo Finance по каждой компании, пресс-релизы компаний там, где они читаются, CNBC, WSJ, Bloomberg, MarketWatch, Seeking Alpha, Benzinga. Для всех сразу: Cointelegraph, CoinDesk, ФРС США, Investing, MarketWatch, а также мировые события (войны, санкции, удары, отношения между странами): BBC World, Al Jazeera и поиск по геополитике.\n\nПока не читаю: X, Discord, Telegram-каналы, Reddit. X планируется в версии Full, остальное пока не подключено. У части монет собственных новостей мало, тогда вердикт опирается на общий фон рынка.',
    privText: '<b>Приватность</b>\nБот пишет только тем, кто сам его запустил. Он не читает ваши чаты, каналы и аккаунты.\n\nХранится: номер вашего чата, выбранные монеты, время, часовой пояс, язык и последний вердикт по монетам. Ничего больше.\n\nУдалить всё можно в любой момент кнопкой ниже или командой /stop.',
    settingsHead: 'Настройки', time: 'Время', tz: 'Часовой пояс', lang: 'Язык',
    alertsLine: on => `Срочные уведомления о перевороте: ${on ? 'включены' : 'выключены'}`, alertsBtn: on => `Уведомления: ${on ? 'вкл' : 'выкл'}`, alertHead: x => `Развернулся вердикт: ${x}`, alertOff: 'Выключить такие уведомления', alertsOffDone: 'Срочные уведомления выключены. Включить: Настройки.', alertsOnDone: 'Срочные уведомления включены.',
    timeHead: 'Во сколько присылать сводку?', timeHint: 'Другое время: /time 08:30', tzHead: 'Ваш часовой пояс?', tzHint: 'Другого города нет: /tz Europe/Berlin', langHead: 'Язык сводок',
    timeSet: t => `Время: ${t}.`, tzSet: z => `Пояс: ${z}.`, langSet: 'Язык: русский.',
    wait: 'Печатаю сводку, это займёт до минуты.', slow: 'Не так часто, подождите полминуты.',
    detail: 'Подробнее', moreHint: 'Нажмите на монету, чтобы увидеть причины и ссылки.',
    helpText: `Всё делается кнопками в /menu. Команды для тех, кто любит печатать:\n\n/add BTC ETH - добавить монеты\n/remove BTC - убрать\n/list - мои монеты\n/coins - все монеты\n/now - сводка сейчас\n/news - новости\n/markets - рынки\n/stocks - акции США: выбор, сводка, таблица цен\n/time 08:00 - время\n/tz Europe/Kyiv - пояс\n/lang en - язык\n/full - лист ожидания Full\n/stop - удалить мои данные\n\nСводка строится только по открытым новостям и не является советом по торговле.`,
    added: a => `Добавлено: ${a.join(', ')}.`, unknown: u => `Не знаю таких монет или компаний: ${u.join(', ')}. Списки: /coins и /stocks`,
    removed: g => `Убрано: ${g.join(', ')}.`, nothingRemoved: 'Такой монеты нет в вашем списке.',
    coinsAll: c => `Доступные монеты (${c.length}): ${c.join(' ')}`,
    waitlist: 'Записал вас в лист ожидания версии Full (X и другие площадки, глубокий разбор). Цены пока нет: сначала считаем расходы. Напишу, когда будет что показать, и ничего не спишу без вашего согласия.', waitlistAgain: 'Вы уже в листе ожидания Full.',
    stopAsk: 'Удалить ваши монеты и настройки? Сводки приходить перестанут.', stopYes: 'Да, удалить', stopNo: 'Нет, оставить',
    stop: 'Готово, данные удалены. Чтобы вернуться, нажмите /start.',
    limit: 'На сегодня лимит расходов исчерпан, сводка придёт позже.', few: 'Сейчас слишком мало новостей, чтобы судить.', print: 'Не удалось напечатать выпуск. Попробуйте позже.',
    head: d => `NewsTide: крипто-сводка за ${d}`, unknownCmd: 'Не понял. Нажмите кнопку или откройте /menu.'
  },
  en: {
    welcome: `<b>NewsTide</b>: the news background for your coins.\n\nPick up to ${MAX_COINS} coins and every morning I send one short summary: where the news point now, ↑ up, ↓ down or ↔ no clear direction. If the direction flips, I write right away, not at the next morning.\n\nThis is not a price forecast and not trading advice: I read the news and show what they look like. See a sample summary with the button below.`,
    pickCoins: 'Pick coins', quick: `Quick start: ${QUICK_START.join(' ')}`, example: 'Sample summary',
    exampleTitle: 'Sample summary (made-up data)',
    exampleBody: ['🟢📈 <b>BTC</b> Growth expected', '<i>Long: for · Short: against</i>', '🔵↔️ <b>ETH</b> No clear direction for now', '<i>Long: unclear · Short: unclear</i>', '🔴📉 <b>SOL</b> Correction risk', '<i>Long: against · Short: for</i>', '', '⚠ <b>The verdict flipped:</b> SOL (up → down)', '', '<i>🟢📈 the news point up, 🔴📉 down, 🔵↔️ no clear direction. Horizon: the next day, from the news of the last 24 hours. This is the crypto market, not trading advice.</i>', '', 'Under a real summary there are coin buttons: tap one to see the reasons and the news links.'],
    menuHead: 'Menu', noCoins: 'No coins yet.', yourCoins: c => `Your coins: ${c.join(', ')}`,
    schedule: (t, tz) => `The summary arrives at ${t} (${tz}).`,
    bNow: 'Summary now', bCoins: 'My coins', bSettings: 'Settings', bFull: 'Full version', bHelp: 'Help', bBack: 'Back', bDone: n => `Done (${n})`,
    pickHead: n => `Pick coins, up to ${MAX_COINS}. Selected: ${n}.`, pickHint: 'Coin not in the list? Send its ticker with /add.',
    pickedNote: 'Done. Press "Summary now" to see the first one.', quickNote: c => `Added ${c.join(', ')}. Press "Summary now" to see the first one.`,
    limitReached: `Limit is ${MAX_COINS} coins. Remove one first.`, empty: 'Pick some coins first.',
    bStocks: 'Price table: top 100', stocksFail: 'Could not get the stock quotes, try later.', stocksLoading: 'Loading the stocks...',
    slowdown: 'Not so fast, wait a few seconds.',
    bStk: 'US stocks', stkHead: 'US stocks', stkMine: s => `Your stocks: ${s.join(', ')}`, stkNone: 'No stocks yet.',
    stkDesc: 'The stock summary arrives with the morning crypto summary. It reads SEC filings (form 8-K), headlines about the company and the market news of the last 24 hours. Not investment advice.',
    bPickStocks: 'Pick stocks', bStockNow: 'Stock summary', bStockNews: 'Stock news', bStockTable: 'Price table: top 100',
    stockPickHead: n => `Pick stocks, up to ${MAX_STOCKS}. Selected: ${n}.`, stockPickHint: 'Not in the tabs? Send /add Apple or /add AAPL: a ticker or a company name works.',
    stockMoreHint: 'Tap a company to see the reasons, the price and the links.',
    stockPicked: 'Done. Press "Stock summary" to see the first one.', stockLimit: `Limit is ${MAX_STOCKS} stocks. Remove one first.`, stockEmpty: 'Pick some stocks first.',
    stockAdded: a => `Stocks added: ${a.join(', ')}.`, stockHead: d => `NewsTide: US stocks for ${d}`,
    stockClosed: 'The US market is closed now: the read covers the news since the last session, and the next move may come at the open.',
    newsStocks: 'My stocks', newsMarket: 'Stock market', newsNoStocks: 'Pick some stocks first and I will show the news about them.',
    bNews: 'News', bMarkets: 'Markets', newsHead: 'News: what to show?', newsMine: 'My coins', newsCrypto: 'Crypto market', newsWorld: 'World and macro (wars, the Fed)',
    newsTitles: { mine: 'News about your coins', crypto: 'Crypto market news', world: 'World news and macro', stocks: 'News about your stocks', market: 'Stock market news' }, newsMore: 'More ›', newsPrev: '‹ Back', newsSections: 'Sections', newsLoading: 'Loading the news...',
    newsHint: 'Headlines link to the source sites. Read the full text there.', newsNoCoins: 'Pick some coins first and I will show the news about them.', marketsLoading: 'Loading the markets...', marketsFail: 'Could not get the quotes, try later.',
    moodUp: 'The bull: the news on your coins mostly point up', moodDown: 'The bear: the news on your coins mostly point down', moodFlat: 'The hamster: no clear direction',
    bAbout: 'About', bRead: 'How to read it', bSources: 'Where news come from', bPriv: 'Privacy', bDelete: 'Delete my data',
    aboutText: '<b>About the bot</b>\nNewsTide reads the news and shows where they point your coin or a top-100 US stock right now. You pick coins (up to ' + MAX_COINS + '), the bot sends one short summary every morning and writes on its own if a verdict flips.\n\n<b>What it does.</b> Reads project blogs and forums, developer releases, big crypto media and macro news. A model turns that into one verdict per coin, with links to the news it rests on.\n\n<b>What it does not do.</b> It does not predict the price, give trading advice or know the future.',
    readText: '<b>How to read the summary</b>\n🟢📈 the news point up\n🔴📉 the news point down\n🔵↔️ no clear direction: quiet, or the news pull both ways\n\n<b>Long and Short</b> say what this means for your idea: if you buy (Long) or sell short (Short), is the news background for you, against you or unclear.\n\n<b>Horizon:</b> the next day. Only the news of the last 24 hours at the moment of the request is used. There is no separate read for the 4-hour or shorter charts.\n\nThe coin button under a summary opens the reasons step by step and the news links.\n\n⚠ <b>The verdict flipped</b> means it was up and is now down (or the other way). I send that at once, in the daytime. Not at night: then the flip is in the morning summary.',
    srcText: '<b>Where the news come from</b>\nFor every coin: the project blog and forum, developer releases on GitHub and a news search about it. For stocks: SEC filings (form 8-K) and Yahoo Finance headlines for each company, company press releases where they can be read, CNBC, WSJ, Bloomberg, MarketWatch, Seeking Alpha, Benzinga. For all: Cointelegraph, CoinDesk, the US Fed, Investing, MarketWatch, plus world events (wars, sanctions, strikes, relations between states): BBC World, Al Jazeera and a geopolitics search.\n\nNot read yet: X, Discord, Telegram channels, Reddit. X is planned for the Full version, the rest is not connected yet. Some coins have little news of their own; then the verdict leans on the general market background.',
    privText: '<b>Privacy</b>\nThe bot writes only to people who started it. It does not read your chats, channels or accounts.\n\nStored: your chat number, picked coins, time, time zone, language and the last verdict per coin. Nothing else.\n\nYou can delete it all at any time with the button below or /stop.',
    settingsHead: 'Settings', time: 'Time', tz: 'Time zone', lang: 'Language',
    alertsLine: on => `Instant flip alerts: ${on ? 'on' : 'off'}`, alertsBtn: on => `Alerts: ${on ? 'on' : 'off'}`, alertHead: x => `The verdict flipped: ${x}`, alertOff: 'Turn these alerts off', alertsOffDone: 'Instant alerts are off. Turn them on in Settings.', alertsOnDone: 'Instant alerts are on.',
    timeHead: 'When should I send the summary?', timeHint: 'Another time: /time 08:30', tzHead: 'Your time zone?', tzHint: 'City not listed: /tz Europe/Berlin', langHead: 'Summary language',
    timeSet: t => `Time: ${t}.`, tzSet: z => `Zone: ${z}.`, langSet: 'Language: English.',
    wait: 'Printing the summary, up to a minute.', slow: 'Not so fast, wait half a minute.',
    detail: 'Details', moreHint: 'Tap a coin to see the reasons and links.',
    helpText: `Everything works with the buttons in /menu. Commands for those who like typing:\n\n/add BTC ETH - add coins\n/remove BTC - remove\n/list - my coins\n/coins - all coins\n/now - summary now\n/news - news\n/markets - markets\n/stocks - US stocks: pick, summary, price table\n/time 08:00 - time\n/tz Europe/Kyiv - zone\n/lang ru - language\n/full - Full waiting list\n/stop - delete my data\n\nThe summary is built from public news only and is not trading advice.`,
    added: a => `Added: ${a.join(', ')}.`, unknown: u => `Unknown coins or companies: ${u.join(', ')}. See /coins and /stocks`,
    removed: g => `Removed: ${g.join(', ')}.`, nothingRemoved: 'That coin is not on your list.',
    coinsAll: c => `Available coins (${c.length}): ${c.join(' ')}`,
    waitlist: 'You are on the waiting list for Full (X and other platforms, deeper analysis). There is no price yet: we are still counting costs. I will write when there is something to show, and charge nothing without your consent.', waitlistAgain: 'You are already on the Full waiting list.',
    stopAsk: 'Delete your coins and settings? The summaries will stop.', stopYes: 'Yes, delete', stopNo: 'No, keep',
    stop: 'Done, your data is deleted. Press /start to come back.',
    limit: 'Today\'s spending limit is used up, the summary will come later.', few: 'Too little news right now to judge.', print: 'Could not print the edition. Try again later.',
    head: d => `NewsTide: crypto summary for ${d}`, unknownCmd: 'Did not get that. Press a button or open /menu.'
  }
};

const btn = (text, data) => ({ text, callback_data: data });
const kb = rows => ({ inline_keyboard: rows });
const chunk = (list, n) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));

export function createBot({ tg, users, save, coins, stocks = [], getStockEdition, getEdition, getNews, getQuotes, getStocks, translateTexts, photos = {}, now = () => new Date(), log = console }) {
  const bySymbol = new Map(coins.map(c => [c.symbol, c]));
  const stockBy = new Map(stocks.map(s => [s.symbol, s]));
  const known = new Set(bySymbol.keys());
  const lastNow = new Map();
  // Per-chat limit for the buttons that fetch feeds, quotes or translations: 8 presses per 10 seconds.
  const presses = new Map();
  const allowed = chatId => {
    const t = Date.now();
    const recent = (presses.get(chatId) ?? []).filter(x => t - x < 10000);
    if (recent.length >= 8) { presses.set(chatId, recent); return false; }
    presses.set(chatId, [...recent, t]);
    return true;
  };
  const shown = new Map(); // "chat:SYM" -> the edition shown in the latest summary, for the details button
  const tx = u => T[u.lang] ?? T.ru;
  const L = (u, i) => (u.lang === 'en' ? TZS[i][2] : TZS[i][1]);

  const remember = (chatId, sym, ed) => {
    shown.set(`${chatId}:${sym}`, ed);
    if (shown.size > 600) shown.delete(shown.keys().next().value);
  };

  // ---------- screens: { text, markup } ----------
  const menuScreen = (u, note) => {
    const t = tx(u);
    const text = [`<b>${t.menuHead}</b>`, note ? esc(note) : '', u.coins.length ? esc(t.yourCoins(u.coins)) : esc(t.noCoins), u.stocks?.length ? esc(t.stkMine(u.stocks)) : '', esc(t.schedule(u.time, u.tz))].filter(x => x !== '').join('\n');
    return { text, markup: kb([[btn(t.bNow, 'now'), btn(t.bCoins, 'pick')], [btn(t.bStk, 'stk'), btn(t.bNews, 'news')], [btn(t.bMarkets, 'mk'), btn(t.bSettings, 'set')], [btn(t.bAbout, 'about'), btn(t.bFull, 'full')], [btn(t.bHelp, 'help')]]) };
  };
  const welcomeScreen = u => {
    const t = tx(u);
    return { text: t.welcome, markup: kb([[btn(t.pickCoins, 'pick')], [btn(t.quick, 'q')], [btn(t.example, 'ex')]]) };
  };
  const pickScreen = (u, group = 'top') => {
    const t = tx(u);
    const tabs = GROUPS.map(([id, ru, en]) => btn(`${id === group ? '• ' : ''}${u.lang === 'en' ? en : ru}`, `pg:${id}`));
    const inGroup = coins.filter(c => c.group === group);
    const grid = chunk(inGroup.map(c => btn(`${u.coins.includes(c.symbol) ? '✅ ' : ''}${c.symbol}`, `c:${c.symbol}:${group}`)), 4);
    return {
      text: `${esc(t.pickHead(u.coins.length))}${u.coins.length ? `\n${esc(u.coins.join(', '))}` : ''}\n\n<i>${esc(t.pickHint)}</i>`,
      markup: kb([tabs, ...grid, [btn(t.bDone(u.coins.length), 'pdone')]])
    };
  };
  const stocksHub = (u, note) => {
    const t = tx(u);
    u.stocks ??= [];
    const text = [`<b>${t.stkHead}</b>`, note ? esc(note) : '', u.stocks.length ? esc(t.stkMine(u.stocks)) : esc(t.stkNone), `<i>${esc(t.stkDesc)}</i>`].filter(Boolean).join('\n');
    return { text, markup: kb([[btn(t.bPickStocks, 'sp'), btn(t.bStockNow, 'snow')], [btn(t.bStockNews, 'nw:stocks:0'), btn(t.bStockTable, 'st:0')], [btn(t.bBack, 'menu')]]) };
  };
  const stockPickScreen = (u, group = 'tech') => {
    const t = tx(u);
    u.stocks ??= [];
    const tabs = chunk(SGROUPS.map(([id, ru, en]) => btn(`${id === group ? '• ' : ''}${u.lang === 'en' ? en : ru}`, `sg:${id}`)), 4);
    const grid = chunk(stocks.filter(x => x.group === group).map(x => btn(`${u.stocks.includes(x.symbol) ? '✅ ' : ''}${x.symbol}`, `sc:${x.symbol}:${group}`)), 4);
    return {
      text: `${esc(t.stockPickHead(u.stocks.length))}${u.stocks.length ? `\n${esc(u.stocks.join(', '))}` : ''}\n\n<i>${esc(t.stockPickHint)}</i>`,
      markup: kb([...tabs, ...grid, [btn(t.bDone(u.stocks.length), 'sdone')]])
    };
  };
  const settingsScreen = u => {
    const t = tx(u);
    const text = `<b>${t.settingsHead}</b>\n${esc(t.schedule(u.time, u.tz))}\n${esc(t.lang)}: ${u.lang === 'en' ? 'English' : 'Русский'}\n${esc(t.alertsLine(u.alerts !== false))}`;
    return { text, markup: kb([[btn(t.time, 'tm'), btn(t.tz, 'tzp'), btn(t.lang, 'lg')], [btn(t.alertsBtn(u.alerts !== false), 'al')], [btn(t.bBack, 'menu')]]) };
  };
  const timeScreen = u => {
    const t = tx(u);
    return { text: `${esc(t.timeHead)}\n<i>${esc(t.timeHint)}</i>`, markup: kb([...chunk(TIMES.map(x => btn(`${u.time === x ? '✅ ' : ''}${x}`, `t:${x}`)), 4), [btn(t.bBack, 'set')]]) };
  };
  const tzScreen = u => {
    const t = tx(u);
    return { text: `${esc(t.tzHead)}\n<i>${esc(t.tzHint)}</i>`, markup: kb([...chunk(TZS.map((z, i) => btn(`${u.tz === z[0] ? '✅ ' : ''}${L(u, i)}`, `z:${i}`)), 2), [btn(t.bBack, 'set')]]) };
  };
  const langScreen = u => {
    const t = tx(u);
    return { text: esc(t.langHead), markup: kb([[btn(`${u.lang === 'ru' ? '✅ ' : ''}Русский`, 'l:ru'), btn(`${u.lang === 'en' ? '✅ ' : ''}English`, 'l:en')], [btn(t.bBack, 'set')]]) };
  };
  const aboutScreen = (u, part = 'about') => {
    const t = tx(u);
    const text = { about: t.aboutText, read: t.readText, src: t.srcText, priv: t.privText }[part] ?? t.aboutText;
    const back = part === 'about' ? btn(t.bBack, 'menu') : btn(t.bBack, 'about');
    const rows = part === 'about' ? [[btn(t.bRead, 'ab:read')], [btn(t.bSources, 'ab:src')], [btn(t.bPriv, 'ab:priv')], [back]]
      : part === 'priv' ? [[btn(t.bDelete, 'stop')], [back]] : [[back]];
    return { text, markup: kb(rows) };
  };
  const helpScreen = u => ({ text: esc(tx(u).helpText), markup: kb([[btn(tx(u).bBack, 'menu')]]) });
  const stopScreen = u => ({ text: esc(tx(u).stopAsk), markup: kb([[btn(tx(u).stopYes, 'stopyes'), btn(tx(u).stopNo, 'menu')]]) });

  const reply = (chatId, screen) => tg.send(chatId, screen.text, screen.markup);
  // Redraw the message a button was pressed on; if Telegram refuses (too old, unchanged), send a fresh one.
  async function show(chatId, mid, screen) {
    if (!mid) return reply(chatId, screen);
    try { await tg.edit(chatId, mid, screen.text, screen.markup); }
    catch (err) { if (!/not modified/i.test(err.message)) await reply(chatId, screen); }
  }

  // ---------- the summary ----------
  async function sendDigest(chatId, user, { markSent = false } = {}) {
    const t = tx(user);
    user.stocks ??= [];
    const { date } = localClock(user.tz, now());
    const [y, mo, d] = date.split('-');
    const results = [];
    for (const sym of user.coins) {
      try {
        const ed = await getEdition(bySymbol.get(sym), '1d');
        results.push({ sym, ed, prev: user.last[sym]?.direction });
        remember(chatId, sym, ed);
        user.last[sym] = { direction: ed.direction, verdict: ed.verdict, at: new Date().toISOString() };
      } catch (err) {
        log.error('[bot digest]', sym, err.message);
        results.push({ sym, ed: null, err: t[err.reason] ?? t.print });
      }
    }
    if (results.length) {
      await sendMood(chatId, user, results);
      const rows = chunk(results.filter(r => r.ed).map(r => btn(`${r.sym} ›`, `m:${r.sym}`)), 4);
      rows.push([btn(t.menuHead, 'menu')]);
      await tg.send(chatId, `${summaryMessage(results, { lang: user.lang, head: t.head(`${d}.${mo}.${y}`) })}\n\n${esc(t.moreHint)}`, kb(rows));
      const failed = results.find(r => !r.ed);
      if (failed) await tg.send(chatId, esc(`${failed.sym}: ${failed.err}`));
    }
    await sendStockDigest(chatId, user, `${d}.${mo}.${y}`);
    if (markSent) user.lastSent = date;
    await save(users);
  }

  // The stock summary: its own message, because stocks are another market with its own trading hours.
  async function sendStockDigest(chatId, user, dateText) {
    if (!user.stocks?.length || !getStockEdition) return;
    const t = tx(user);
    const results = [];
    let closed = false;
    for (const sym of user.stocks) {
      try {
        const ed = await getStockEdition(stockBy.get(sym), '1d');
        results.push({ sym, ed });
        remember(chatId, `s:${sym}`, ed);
        if (ed.market_open === false) closed = true;
      } catch (err) {
        log.error('[bot stock digest]', sym, err.message);
        results.push({ sym, ed: null, err: t[err.reason] ?? t.print });
      }
    }
    const rows = chunk(results.filter(r => r.ed).map(r => btn(`${r.sym} ›`, `ms:${r.sym}`)), 4);
    rows.push([btn(t.menuHead, 'menu')]);
    await tg.send(chatId, `${summaryMessage(results, { lang: user.lang, head: t.stockHead(dateText), asset: 'stock', note: closed ? t.stockClosed : undefined })}\n\n${esc(t.stockMoreHint)}`, kb(rows));
    const failed = results.find(r => !r.ed);
    if (failed) await tg.send(chatId, esc(`${failed.sym}: ${failed.err}`));
  }

  async function sendStockDetail(chatId, u, sym) {
    const t = tx(u);
    const stock = stockBy.get(sym);
    if (!stock || !getStockEdition) return;
    let ed = shown.get(`${chatId}:s:${sym}`);
    try { ed ??= await getStockEdition(stock, '1d'); }
    catch (err) { return tg.send(chatId, esc(`${sym}: ${t[err.reason] ?? t.print}`)); }
    return tg.send(chatId, stockDetailMessage(stock, ed, { lang: u.lang }));
  }

  // A woodcut before the summary: the bull, the bear or the hamster, by what most of the coins say.
  const fileIds = new Map();
  async function sendMood(chatId, u, results) {
    const dirs = results.filter(r => r.ed).map(r => r.ed.direction);
    if (!dirs.length || !tg.sendPhoto) return;
    const up = dirs.filter(d => d === 'up').length, down = dirs.filter(d => d === 'down').length;
    const mood = up > down ? 'up' : down > up ? 'down' : 'sideways';
    const src = fileIds.get(mood) ?? photos[mood];
    if (!src) return;
    const t = tx(u);
    try {
      const msg = await tg.sendPhoto(chatId, src, `<i>${esc({ up: t.moodUp, down: t.moodDown, sideways: t.moodFlat }[mood])}</i>`);
      const id = msg?.photo?.at(-1)?.file_id;
      if (id) fileIds.set(mood, id);
    } catch (err) { log.error('[bot photo]', err.message); }
  }

  // ---------- markets and news ----------
  const newsCache = new Map(); // chat -> { scope, items, ruMap } for paging without refetching
  async function showMarkets(chatId, mid, u) {
    const t = tx(u);
    let text;
    try { text = quotesMessage(await getQuotes(), { lang: u.lang }); } catch (err) { log.error('[bot markets]', err.message); text = esc(t.marketsFail); }
    return show(chatId, mid, { text, markup: kb([[btn(t.bStocks, 'st:0')], [btn(t.bBack, 'menu')]]) });
  }
  async function showStocks(chatId, mid, u, page) {
    const t = tx(u);
    let list = [];
    try { list = await getStocks(); } catch (err) { log.error('[bot stocks]', err.message); }
    if (!list.length) return show(chatId, mid, { text: esc(t.stocksFail), markup: kb([[btn(t.bBack, 'mk')]]) });
    const { text, pages } = stocksPage(list, { page, lang: u.lang });
    const nav = [];
    if (page > 0) nav.push(btn(t.newsPrev, `st:${page - 1}`));
    if (page + 1 < pages) nav.push(btn(t.newsMore, `st:${page + 1}`));
    return show(chatId, mid, { text, markup: kb([...(nav.length ? [nav] : []), [btn(t.bMarkets, 'mk'), btn(t.menuHead, 'menu')]]) });
  }
  const newsSections = u => {
    const t = tx(u);
    return { text: `<b>${esc(t.newsHead)}</b>\n<i>${esc(t.newsHint)}</i>`, markup: kb([[btn(t.newsMine, 'nw:mine:0')], [btn(t.newsCrypto, 'nw:crypto:0')], [btn(t.newsWorld, 'nw:world:0')], [btn(t.newsStocks, 'nw:stocks:0')], [btn(t.newsMarket, 'nw:market:0')], [btn(t.bBack, 'menu')]]) };
  };
  async function showNews(chatId, mid, u, scope, page) {
    const t = tx(u);
    if (!getNews) return;
    u.stocks ??= [];
    if (scope === 'stocks' && !u.stocks.length) return show(chatId, mid, { text: esc(t.newsNoStocks), markup: kb([[btn(t.bPickStocks, 'sp')], [btn(t.bBack, 'news')]]) });
    if (scope === 'mine' && !u.coins.length) return show(chatId, mid, { text: esc(t.newsNoCoins), markup: kb([[btn(t.pickCoins, 'pick')], [btn(t.bBack, 'news')]]) });
    let c = newsCache.get(chatId);
    if (!c || c.scope !== scope || page === 0) {
      let items = [];
      try { items = await getNews(scope, { coins: u.coins.map(s => bySymbol.get(s)).filter(Boolean), stocks: u.stocks.map(s => stockBy.get(s)).filter(Boolean) }); } catch (err) { log.error('[bot news]', err.message); }
      c = { scope, items, ruMap: new Map() };
      newsCache.set(chatId, c);
    }
    const slice = c.items.slice(page * NEWS_PAGE, page * NEWS_PAGE + NEWS_PAGE);
    if (u.lang === 'ru' && translateTexts) {
      const need = slice.flatMap(it => [it.title, it.summary]).filter(x => x && !c.ruMap.has(x));
      for (const [k, v] of await translateTexts(need)) c.ruMap.set(k, v);
    }
    const { text, pages } = newsPage(c.items, { page, title: t.newsTitles[scope], lang: u.lang, tz: u.tz, ruMap: c.ruMap });
    const nav = [];
    if (page > 0) nav.push(btn(t.newsPrev, `nw:${scope}:${page - 1}`));
    if (page + 1 < pages) nav.push(btn(t.newsMore, `nw:${scope}:${page + 1}`));
    return show(chatId, mid, { text, markup: kb([...(nav.length ? [nav] : []), [btn(t.newsSections, 'news'), btn(t.menuHead, 'menu')]]) });
  }

  async function sendDetail(chatId, u, sym) {
    const t = tx(u);
    const coin = bySymbol.get(sym);
    if (!coin) return;
    let ed = shown.get(`${chatId}:${sym}`);
    try { ed ??= await getEdition(coin, '1d'); }
    catch (err) { return tg.send(chatId, esc(`${sym}: ${t[err.reason] ?? t.print}`)); }
    return tg.send(chatId, digestMessage(coin, ed, { lang: u.lang, prev: u.last[sym]?.direction }));
  }

  async function printNow(chatId, u) {
    const t = tx(u);
    if (!u.coins.length && !u.stocks?.length) return tg.send(chatId, esc(t.empty));
    const prevAt = lastNow.get(chatId) ?? 0;
    if (Date.now() - prevAt < 30000) return tg.send(chatId, esc(t.slow));
    lastNow.set(chatId, Date.now());
    await tg.send(chatId, esc(t.wait));
    return sendDigest(chatId, u);
  }

  async function printStocksNow(chatId, u) {
    const t = tx(u);
    const prevAt = lastNow.get(`s:${chatId}`) ?? 0;
    if (Date.now() - prevAt < 30000) return tg.send(chatId, esc(t.slow));
    lastNow.set(`s:${chatId}`, Date.now());
    await tg.send(chatId, esc(t.wait));
    const { date } = localClock(u.tz, now());
    const [y, mo, d] = date.split('-');
    return sendStockDigest(chatId, u, `${d}.${mo}.${y}`);
  }

  async function joinWaitlist(chatId, u) {
    const again = Boolean(u.wantsFull);
    u.wantsFull ??= new Date().toISOString();
    await save(users);
    return tg.send(chatId, esc(again ? tx(u).waitlistAgain : tx(u).waitlist));
  }

  const langOf = from => (/^(ru|uk|be)/.test(from?.language_code ?? '') ? 'ru' : 'en');
  async function ensureUser(chatId, from) {
    if (!users[chatId]) { users[chatId] = newUser(langOf(from)); await save(users); }
    return users[chatId];
  }

  // ---------- buttons ----------
  async function handleCallback(cb) {
    const chatId = String(cb.message?.chat?.id ?? '');
    const mid = cb.message?.message_id;
    const ack = text => tg.answer(cb.id, text).catch(() => {});
    if (!chatId || cb.message.chat.type !== 'private') return ack();
    const u = await ensureUser(chatId, cb.from);
    u.stocks ??= [];
    const t = tx(u);
    const data = String(cb.data ?? '');
    const i = data.indexOf(':');
    const act = i < 0 ? data : data.slice(0, i);
    const arg = i < 0 ? '' : data.slice(i + 1);
    switch (act) {
      case 'menu': await ack(); return show(chatId, mid, menuScreen(u));
      case 'pick': await ack(); return show(chatId, mid, pickScreen(u));
      case 'pg': await ack(); return show(chatId, mid, pickScreen(u, GROUPS.some(g => g[0] === arg) ? arg : 'top'));
      case 'c': {
        const [sym, group] = arg.split(':');
        if (u.coins.includes(sym)) removeCoins(u, [sym]);
        else if (u.coins.length >= MAX_COINS) return ack(t.limitReached);
        else addCoins(u, [sym], known);
        await save(users);
        await ack();
        return show(chatId, mid, pickScreen(u, group));
      }
      case 'pdone':
        if (!u.coins.length) return ack(t.empty);
        await ack(); return show(chatId, mid, menuScreen(u, t.pickedNote));
      case 'q': {
        if (!u.coins.length) addCoins(u, QUICK_START, known);
        await save(users); await ack();
        return show(chatId, mid, menuScreen(u, t.quickNote(u.coins)));
      }
      case 'ex': await ack(); return tg.send(chatId, `<b>${esc(t.exampleTitle)}</b>\n\n${t.exampleBody.join('\n')}`);
      case 'now': await ack(t.wait); return printNow(chatId, u);
      case 'm': await ack(); return sendDetail(chatId, u, arg);
      case 'stk': await ack(); return show(chatId, mid, stocksHub(u));
      case 'sp': await ack(); return show(chatId, mid, stockPickScreen(u));
      case 'sg': await ack(); return show(chatId, mid, stockPickScreen(u, SGROUPS.some(g => g[0] === arg) ? arg : 'tech'));
      case 'sc': {
        const [sym, group] = arg.split(':');
        u.stocks ??= [];
        if (!stockBy.has(sym)) return ack();
        if (u.stocks.includes(sym)) removeStocks(u, [sym]);
        else if (u.stocks.length >= MAX_STOCKS) return ack(t.stockLimit);
        else addStocks(u, [sym]);
        await save(users);
        await ack();
        return show(chatId, mid, stockPickScreen(u, group));
      }
      case 'sdone':
        if (!u.stocks?.length) return ack(t.stockEmpty);
        await ack(); return show(chatId, mid, stocksHub(u, t.stockPicked));
      case 'snow':
        if (!allowed(chatId)) return ack(t.slowdown);
        if (!u.stocks?.length) return ack(t.stockEmpty);
        await ack(t.wait);
        return printStocksNow(chatId, u);
      case 'ms': await ack(); return sendStockDetail(chatId, u, arg);
      case 'set': await ack(); return show(chatId, mid, settingsScreen(u));
      case 'tm': await ack(); return show(chatId, mid, timeScreen(u));
      case 't':
        if (!validTime(arg)) return ack();
        u.time = arg; u.lastSent = ''; await save(users); await ack(t.timeSet(arg));
        return show(chatId, mid, timeScreen(u));
      case 'tzp': await ack(); return show(chatId, mid, tzScreen(u));
      case 'z': {
        const z = TZS[Number(arg)];
        if (!z) return ack();
        u.tz = z[0]; await save(users); await ack(t.tzSet(z[0]));
        return show(chatId, mid, tzScreen(u));
      }
      case 'lg': await ack(); return show(chatId, mid, langScreen(u));
      case 'l':
        if (!['ru', 'en'].includes(arg)) return ack();
        u.lang = arg; await save(users); await ack(tx(u).langSet);
        return show(chatId, mid, langScreen(u));
      case 'al': {
        u.alerts = u.alerts === false; // toggles: undefined/true -> off, false -> on
        await save(users); await ack(u.alerts ? t.alertsOnDone : t.alertsOffDone);
        return show(chatId, mid, settingsScreen(u));
      }
      case 'aloff':
        u.alerts = false; await save(users); await ack(t.alertsOffDone); return;
      case 'full': await ack(); return joinWaitlist(chatId, u);
      case 'mk': if (!allowed(chatId)) return ack(t.slowdown);
        await ack(t.marketsLoading); return showMarkets(chatId, mid, u);
      case 'st': if (!allowed(chatId)) return ack(t.slowdown);
        await ack(t.stocksLoading); return getStocks ? showStocks(chatId, mid, u, Math.max(0, Number(arg) || 0)) : undefined;
      case 'news': await ack(); return show(chatId, mid, newsSections(u));
      case 'nw': {
        const [scope, page] = arg.split(':');
        if (!['mine', 'crypto', 'world', 'stocks', 'market'].includes(scope)) return ack();
        if (!allowed(chatId)) return ack(t.slowdown);
        await ack(t.newsLoading);
        return showNews(chatId, mid, u, scope, Math.max(0, Number(page) || 0));
      }
      case 'about': await ack(); return show(chatId, mid, aboutScreen(u));
      case 'ab': await ack(); return show(chatId, mid, aboutScreen(u, arg));
      case 'help': await ack(); return show(chatId, mid, helpScreen(u));
      case 'stop': await ack(); return show(chatId, mid, stopScreen(u));
      case 'stopyes':
        delete users[chatId]; await save(users); await ack();
        return tg.send(chatId, esc(t.stop));
      default: return ack();
    }
  }

  // ---------- typed commands (the fallback) ----------
  async function handle(msg) {
    const chatId = String(msg.chat.id);
    if (msg.chat.type !== 'private' || !msg.text) return;
    const [cmdRaw, ...args] = msg.text.trim().split(/\s+/);
    const cmd = cmdRaw.toLowerCase().replace(/@.*$/, '');
    if (cmd === '/start') {
      const u = await ensureUser(chatId, msg.from);
      // A link like t.me/newstide_bot?start=chat remembers where the person came from (counted by waitlist.js).
      // Only short plain tags are kept, and only the first one: the link text is typed by anyone.
      if (/^[a-z0-9_-]{1,24}$/i.test(args[0] ?? '') && args[0] !== 'full') u.source ??= args[0].toLowerCase();
      const joined = args[0] === 'full' && !u.wantsFull;
      if (joined) u.wantsFull = new Date().toISOString();
      await save(users);
      await reply(chatId, u.coins.length ? menuScreen(u) : welcomeScreen(u));
      return joined ? tg.send(chatId, esc(tx(u).waitlist)) : undefined;
    }
    const u = users[chatId];
    if (!u) return reply(chatId, welcomeScreen({ lang: langOf(msg.from) }));
    u.stocks ??= [];
    const t = tx(u);
    switch (cmd) {
      case '/menu': return reply(chatId, menuScreen(u));
      case '/help': return reply(chatId, helpScreen(u));
      case '/about': return reply(chatId, aboutScreen(u));
      case '/markets': return showMarkets(chatId, null, u);
      case '/stocks': return reply(chatId, stocksHub(u));
      case '/news': return reply(chatId, newsSections(u));
      case '/coins': return tg.send(chatId, esc(t.coinsAll([...known])));
      case '/list': return reply(chatId, menuScreen(u));
      case '/add': {
        const tokens = args.map(a => a.replace(/[^A-Za-z0-9А-Яа-яЁё.&-]/g, '')).filter(Boolean);
        const coinTokens = tokens.filter(a => known.has(a.toUpperCase()));
        const rc = addCoins(u, coinTokens, known);
        const stockSyms = [], unknownTokens = [];
        for (const a of tokens.filter(a => !known.has(a.toUpperCase()))) {
          const sym = resolveStock(stocks, a);
          if (sym) stockSyms.push(sym); else unknownTokens.push(a.toUpperCase());
        }
        const rs = addStocks(u, stockSyms);
        await save(users);
        const out = [];
        if (rc.added.length) out.push(t.added(rc.added));
        if (rs.added.length) out.push(t.stockAdded(rs.added));
        if (unknownTokens.length) out.push(t.unknown(unknownTokens));
        if (rc.skipped.length && u.coins.length >= MAX_COINS) out.push(t.limitReached);
        if (rs.skipped.length && u.stocks.length >= MAX_STOCKS) out.push(t.stockLimit);
        return args.length ? tg.send(chatId, esc(out.join('\n'))) : reply(chatId, pickScreen(u));
      }
      case '/remove': {
        const gone = removeCoins(u, args);
        const goneStocks = removeStocks(u, args.map(a => resolveStock(stocks, a) ?? a));
        await save(users);
        return tg.send(chatId, esc(gone.length || goneStocks.length ? t.removed([...gone, ...goneStocks]) : t.nothingRemoved));
      }
      case '/time':
        if (!args[0]) return reply(chatId, timeScreen(u));
        if (!validTime(args[0])) return tg.send(chatId, esc(t.timeHint));
        u.time = args[0]; u.lastSent = ''; await save(users);
        return tg.send(chatId, esc(t.timeSet(u.time)));
      case '/tz':
        if (!args[0]) return reply(chatId, tzScreen(u));
        if (!validTz(args[0])) return tg.send(chatId, esc(t.tzHint));
        u.tz = args[0]; await save(users);
        return tg.send(chatId, esc(t.tzSet(u.tz)));
      case '/lang':
        if (!['ru', 'en'].includes(args[0])) return reply(chatId, langScreen(u));
        u.lang = args[0]; await save(users);
        return tg.send(chatId, esc(tx(u).langSet));
      case '/now': return printNow(chatId, u);
      case '/full': return joinWaitlist(chatId, u);
      case '/stop': return reply(chatId, stopScreen(u));
      default: return reply(chatId, { text: esc(t.unknownCmd), markup: menuScreen(u).markup });
    }
  }

  const quiet = u => { const m = localClock(u.tz, now()).minutes; return m >= QUIET_FROM || m < QUIET_TO; };

  // Flip watch: prints an edition for every followed coin (the printer caches for 30 minutes and holds the
  // daily spending limit) and writes at once to anyone whose last seen verdict flipped up<->down.
  // Cost: about 0.0012 $ per coin print, so 40 coins every 4 hours is about 0.29 $ a day, in practice far less.
  async function watch() {
    const subs = Object.entries(users).filter(([, u]) => u.alerts !== false && u.coins.length);
    const syms = [...new Set(subs.flatMap(([, u]) => u.coins))];
    let sent = 0;
    for (const sym of syms) {
      let ed;
      try { ed = await getEdition(bySymbol.get(sym), '1d'); }
      catch (err) { if (err.reason === 'limit') return sent; continue; }
      for (const [chatId, u] of subs) {
        const prev = u.last[sym]?.direction;
        if (!u.coins.includes(sym) || !flipped(prev, ed.direction) || quiet(u)) continue;
        if (now().getTime() - Date.parse(u.alertAt?.[sym] ?? 0) < ALERT_COOLDOWN_MS) continue;
        const t = tx(u);
        try {
          await tg.send(chatId, `<b>${esc(t.alertHead(sym))}</b>\n\n${digestMessage(bySymbol.get(sym), ed, { lang: u.lang, prev })}`, kb([[btn(t.menuHead, 'menu'), btn(t.alertOff, 'aloff')]]));
          u.last[sym] = { direction: ed.direction, verdict: ed.verdict, at: now().toISOString() };
          (u.alertAt ??= {})[sym] = now().toISOString();
          remember(chatId, sym, ed);
          await save(users);
          sent++;
        } catch (err) {
          log.error('[bot watch]', chatId, err.message);
          if (err.code === 403) { delete users[chatId]; await save(users); }
        }
      }
    }
    return sent;
  }

  // Called every half minute: sends the daily summary to everyone who is due.
  async function tick() {
    for (const [chatId, u] of Object.entries(users)) {
      if (!isDue(u, now())) continue;
      u.lastSent = localClock(u.tz, now()).date; // mark first, so a slow print cannot send twice
      try { await sendDigest(chatId, u, { markSent: true }); }
      catch (err) {
        log.error('[bot tick]', chatId, err.message);
        if (err.code === 403) { delete users[chatId]; await save(users); } // the user blocked the bot
      }
    }
  }

  return { handle, handleCallback, tick, watch, sendDigest };
}
