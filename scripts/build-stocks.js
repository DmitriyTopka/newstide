// Build Stocks: writes config/stocks.json, the top 100 US companies with their feeds.
// Run once after editing the table below: node scripts/build-stocks.js
// The list is compiled by hand (order is approximate, by market value). Every company gets the same three
// feeds by template (Yahoo Finance by ticker, Google News by name, SEC EDGAR 8-K filings by ticker),
// plus the company's own press-release RSS where one exists and answers. The official site is a link only.
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// symbol, name, group, Russian name, official site, own press-release RSS (optional)
const T = [
  ['AAPL', 'Apple', 'tech', 'Эппл', 'https://www.apple.com', 'https://www.apple.com/newsroom/rss-feed.rss'],
  ['MSFT', 'Microsoft', 'tech', 'Майкрософт', 'https://www.microsoft.com', 'https://news.microsoft.com/feed/'],
  ['NVDA', 'NVIDIA', 'tech', 'Нвидиа', 'https://www.nvidia.com', 'https://nvidianews.nvidia.com/releases.xml'],
  ['AMZN', 'Amazon', 'consumer', 'Амазон', 'https://www.aboutamazon.com'],
  ['GOOGL', 'Alphabet', 'tech', 'Альфабет Гугл', 'https://abc.xyz', 'https://blog.google/rss/'],
  ['META', 'Meta Platforms', 'tech', 'Мета Фейсбук', 'https://about.meta.com', 'https://about.fb.com/news/feed/'],
  ['AVGO', 'Broadcom', 'tech', 'Бродком', 'https://www.broadcom.com'],
  ['TSLA', 'Tesla', 'consumer', 'Тесла', 'https://www.tesla.com'],
  ['BRK-B', 'Berkshire Hathaway', 'finance', 'Беркшир Хатауэй Баффет', 'https://www.berkshirehathaway.com'],
  ['LLY', 'Eli Lilly', 'health', 'Эли Лилли', 'https://www.lilly.com'],
  ['JPM', 'JPMorgan Chase', 'finance', 'Джей Пи Морган', 'https://www.jpmorganchase.com'],
  ['WMT', 'Walmart', 'consumer', 'Уолмарт', 'https://corporate.walmart.com'],
  ['V', 'Visa', 'finance', 'Виза', 'https://corporate.visa.com'],
  ['ORCL', 'Oracle', 'tech', 'Оракл', 'https://www.oracle.com'],
  ['MA', 'Mastercard', 'finance', 'Мастеркард', 'https://www.mastercard.com'],
  ['XOM', 'Exxon Mobil', 'energy', 'Эксон Мобил', 'https://corporate.exxonmobil.com'],
  ['UNH', 'UnitedHealth', 'health', 'ЮнайтедХелс', 'https://www.unitedhealthgroup.com'],
  ['COST', 'Costco', 'consumer', 'Костко', 'https://www.costco.com'],
  ['NFLX', 'Netflix', 'consumer', 'Нетфликс', 'https://www.netflix.com'],
  ['HD', 'Home Depot', 'consumer', 'Хоум Депо', 'https://www.homedepot.com'],
  ['PG', 'Procter & Gamble', 'consumer', 'Проктер энд Гэмбл', 'https://www.pg.com'],
  ['JNJ', 'Johnson & Johnson', 'health', 'Джонсон энд Джонсон', 'https://www.jnj.com'],
  ['BAC', 'Bank of America', 'finance', 'Банк оф Америка', 'https://www.bankofamerica.com'],
  ['ABBV', 'AbbVie', 'health', 'Эббви', 'https://www.abbvie.com'],
  ['CRM', 'Salesforce', 'tech', 'Сейлсфорс', 'https://www.salesforce.com'],
  ['CVX', 'Chevron', 'energy', 'Шеврон', 'https://www.chevron.com'],
  ['KO', 'Coca-Cola', 'consumer', 'Кока-Кола', 'https://www.coca-colacompany.com'],
  ['AMD', 'AMD', 'tech', 'АМД', 'https://www.amd.com'],
  ['TMUS', 'T-Mobile US', 'tech', 'Ти-Мобайл', 'https://www.t-mobile.com'],
  ['WFC', 'Wells Fargo', 'finance', 'Уэллс Фарго', 'https://www.wellsfargo.com'],
  ['CSCO', 'Cisco', 'tech', 'Сиско', 'https://www.cisco.com'],
  ['MRK', 'Merck', 'health', 'Мерк', 'https://www.merck.com'],
  ['PEP', 'PepsiCo', 'consumer', 'Пепси', 'https://www.pepsico.com'],
  ['ACN', 'Accenture', 'tech', 'Аксенчер', 'https://www.accenture.com'],
  ['ADBE', 'Adobe', 'tech', 'Адоби', 'https://www.adobe.com'],
  ['LIN', 'Linde', 'industrial', 'Линде', 'https://www.linde.com'],
  ['IBM', 'IBM', 'tech', 'Ай-Би-Эм', 'https://www.ibm.com'],
  ['MCD', "McDonald's", 'consumer', 'Макдоналдс', 'https://corporate.mcdonalds.com'],
  ['ABT', 'Abbott', 'health', 'Эбботт', 'https://www.abbott.com'],
  ['GE', 'GE Aerospace', 'industrial', 'Дженерал Электрик', 'https://www.geaerospace.com'],
  ['NOW', 'ServiceNow', 'tech', 'СервисНау', 'https://www.servicenow.com'],
  ['PM', 'Philip Morris', 'consumer', 'Филип Моррис', 'https://www.pmi.com'],
  ['QCOM', 'Qualcomm', 'tech', 'Куалкомм', 'https://www.qualcomm.com'],
  ['DIS', 'Disney', 'consumer', 'Дисней', 'https://thewaltdisneycompany.com'],
  ['TXN', 'Texas Instruments', 'tech', 'Техас Инструментс', 'https://www.ti.com'],
  ['CAT', 'Caterpillar', 'industrial', 'Катерпиллар', 'https://www.caterpillar.com'],
  ['ISRG', 'Intuitive Surgical', 'health', 'Интуитив Сёрджикал', 'https://www.intuitive.com'],
  ['INTU', 'Intuit', 'tech', 'Интуит', 'https://www.intuit.com'],
  ['VZ', 'Verizon', 'tech', 'Верайзон', 'https://www.verizon.com'],
  ['PLTR', 'Palantir', 'tech', 'Палантир', 'https://www.palantir.com'],
  ['AMGN', 'Amgen', 'health', 'Амджен', 'https://www.amgen.com'],
  ['UBER', 'Uber', 'consumer', 'Убер', 'https://www.uber.com'],
  ['BKNG', 'Booking Holdings', 'consumer', 'Букинг', 'https://www.bookingholdings.com'],
  ['GS', 'Goldman Sachs', 'finance', 'Голдман Сакс', 'https://www.goldmansachs.com'],
  ['RTX', 'RTX', 'industrial', 'РТХ Рэйтеон', 'https://www.rtx.com'],
  ['SPGI', 'S&P Global', 'finance', 'Эс энд Пи Глобал', 'https://www.spglobal.com'],
  ['BLK', 'BlackRock', 'finance', 'Блэкрок', 'https://www.blackrock.com'],
  ['MS', 'Morgan Stanley', 'finance', 'Морган Стэнли', 'https://www.morganstanley.com'],
  ['AXP', 'American Express', 'finance', 'Американ Экспресс', 'https://www.americanexpress.com'],
  ['NEE', 'NextEra Energy', 'energy', 'НекстЭра', 'https://www.nexteraenergy.com'],
  ['HON', 'Honeywell', 'industrial', 'Хоневелл', 'https://www.honeywell.com'],
  ['LOW', "Lowe's", 'consumer', 'Лоуз', 'https://www.lowes.com'],
  ['UNP', 'Union Pacific', 'industrial', 'Юнион Пасифик', 'https://www.up.com'],
  ['PGR', 'Progressive', 'finance', 'Прогрессив', 'https://www.progressive.com'],
  ['T', 'AT&T', 'tech', 'Эй-Ти-энд-Ти', 'https://www.att.com'],
  ['SYK', 'Stryker', 'health', 'Страйкер', 'https://www.stryker.com'],
  ['TJX', 'TJX', 'consumer', 'ТиДжейИкс', 'https://www.tjx.com'],
  ['SCHW', 'Charles Schwab', 'finance', 'Чарльз Шваб', 'https://www.schwab.com'],
  ['DE', 'Deere', 'industrial', 'Дир Джон Дир', 'https://www.deere.com'],
  ['BSX', 'Boston Scientific', 'health', 'Бостон Сайентифик', 'https://www.bostonscientific.com'],
  ['C', 'Citigroup', 'finance', 'Ситигруп Ситибанк', 'https://www.citigroup.com'],
  ['COP', 'ConocoPhillips', 'energy', 'КонокоФиллипс', 'https://www.conocophillips.com'],
  ['ETN', 'Eaton', 'industrial', 'Итон', 'https://www.eaton.com'],
  ['VRTX', 'Vertex Pharmaceuticals', 'health', 'Вертекс', 'https://www.vrtx.com'],
  ['PFE', 'Pfizer', 'health', 'Пфайзер Пфизер', 'https://www.pfizer.com'],
  ['LMT', 'Lockheed Martin', 'industrial', 'Локхид Мартин', 'https://www.lockheedmartin.com'],
  ['ADP', 'ADP', 'industrial', 'Эй-Ди-Пи', 'https://www.adp.com'],
  ['MDT', 'Medtronic', 'health', 'Медтроник', 'https://www.medtronic.com'],
  ['BA', 'Boeing', 'industrial', 'Боинг', 'https://www.boeing.com'],
  ['MU', 'Micron', 'tech', 'Микрон', 'https://www.micron.com'],
  ['AMAT', 'Applied Materials', 'tech', 'Эпплайд Матириалс', 'https://www.appliedmaterials.com'],
  ['PANW', 'Palo Alto Networks', 'tech', 'Пало Альто', 'https://www.paloaltonetworks.com'],
  ['ADI', 'Analog Devices', 'tech', 'Аналог Девайсес', 'https://www.analog.com'],
  ['GILD', 'Gilead Sciences', 'health', 'Гилеад', 'https://www.gilead.com'],
  ['SBUX', 'Starbucks', 'consumer', 'Старбакс', 'https://www.starbucks.com'],
  ['MMC', 'Marsh McLennan', 'finance', 'Марш Макленнан', 'https://www.marshmclennan.com'],
  ['CB', 'Chubb', 'finance', 'Чабб', 'https://www.chubb.com'],
  ['KKR', 'KKR', 'finance', 'КККР', 'https://www.kkr.com'],
  ['LRCX', 'Lam Research', 'tech', 'Лэм Ресёрч', 'https://www.lamresearch.com'],
  ['INTC', 'Intel', 'tech', 'Интел', 'https://www.intel.com'],
  ['UPS', 'UPS', 'industrial', 'ЮПС', 'https://www.ups.com'],
  ['NKE', 'Nike', 'consumer', 'Найк', 'https://www.nike.com'],
  ['SO', 'Southern Company', 'energy', 'Саузерн', 'https://www.southerncompany.com'],
  ['DUK', 'Duke Energy', 'energy', 'Дюк Энерджи', 'https://www.duke-energy.com'],
  ['MO', 'Altria', 'consumer', 'Альтрия', 'https://www.altria.com'],
  ['ELV', 'Elevance Health', 'health', 'Элеванс', 'https://www.elevancehealth.com'],
  ['ANET', 'Arista Networks', 'tech', 'Арист', 'https://www.arista.com'],
  ['CME', 'CME Group', 'finance', 'СиЭмИ', 'https://www.cmegroup.com'],
  ['COIN', 'Coinbase', 'crypto', 'Коинбейс', 'https://www.coinbase.com'],
  ['MSTR', 'Strategy (MicroStrategy)', 'crypto', 'Стратегия МайкроСтратеджи', 'https://www.strategy.com']
];

const enc = encodeURIComponent;
// Words that name many things besides the company: never used alone as a keyword.
const COMMON = new Set(['home', 'bank', 'american', 'united', 'general', 'southern', 'charles', 'morgan', 'goldman', 'johnson', 'procter', 'eli', 'texas', 'applied', 'analog', 'union', 'boston', 'palo', 'lam', 'deere', 'marsh', 'booking', 'strategy', 'meta']);
const keywordsOf = (symbol, name) => {
  const first = name.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim().split(/\s+/)[0];
  const words = [];
  if (first.length >= 4 && !COMMON.has(first)) words.push(` ${first} `);
  if (symbol.length >= 3 && !symbol.includes('-')) words.push(` ${symbol.toLowerCase()} `);
  if (symbol === 'META') words.push(' meta ', ' facebook ', ' instagram ');
  if (symbol === 'GOOGL') words.push(' google ', ' youtube ');
  if (symbol === 'BRK-B') words.push(' berkshire ', ' buffett ');
  if (symbol === 'JPM') words.push(' jpmorgan ');
  if (symbol === 'MSTR') words.push(' microstrategy ', ' saylor ');
  if (symbol === 'TMUS') words.push(' t mobile ');
  return words;
};
const stocks = T.map(([symbol, name, group, ru, site, ir], i) => {
  const feeds = [
    { name: `${name} on Yahoo Finance`, kind: 'coin', url: `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${enc(symbol)}&region=US&lang=en-US` },
    { name: `${name} in the news`, kind: 'coin', url: `https://news.google.com/rss/search?q=${enc(`${name} ${symbol} stock`)}+when:1d&hl=en-US&gl=US&ceid=US:en` },
    { name: `${name} SEC filings (8-K)`, kind: 'project', url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${enc(symbol)}&type=8-K&dateb=&owner=include&count=10&output=atom` }
  ];
  if (ir) feeds.push({ name: `${name} press releases`, kind: 'project', url: ir });
  return { rank: i + 1, symbol, name, ru, group, site, keywords: keywordsOf(symbol, name), feeds };
});

if (stocks.length !== 100 || new Set(stocks.map(s => s.symbol)).size !== 100) throw new Error(`Expected 100 unique stocks, got ${stocks.length}`);
await writeFile(path.join(root, 'config/stocks.json'), JSON.stringify({
  note: 'The 100 largest US listed companies, compiled by hand (order is approximate, by market value). Generated by scripts/build-stocks.js. Quotes come from Yahoo Finance.',
  stocks
}, null, 2) + '\n');
console.log(`Wrote ${stocks.length} stocks with ${stocks.reduce((n, s) => n + s.feeds.length, 0)} feeds.`);
