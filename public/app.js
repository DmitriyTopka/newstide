// NewsTide page logic: the form, the countdown, the Indicator View and the cost counter.
import { TEXT } from './i18n.js';

const $ = id => document.getElementById(id);
const money = usd => `$${usd.toFixed(usd > 0 && usd < 0.01 ? 4 : 3)}`;
let sessionSpend = 0;
let coins = [];
let lang = 'en';
try { lang = localStorage.getItem('newstide-lang') === 'ru' ? 'ru' : 'en'; } catch {}
const T = () => TEXT[lang];
let mode = { replay: false, public_live: false };
let last = null; // last result and plan, re-printed when the language changes
let lastMarket = null;

// Theme: the night edition is remembered per browser; nothing else is stored.
function applyTheme(night) {
  document.documentElement.dataset.theme = night ? 'night' : 'day';
  $('themeToggle').textContent = night ? T().day : T().night;
  $('themeToggle').setAttribute('aria-pressed', String(night));
}
let night = false;
try { night = localStorage.getItem('newstide-theme') === 'night'; } catch {}
applyTheme(night);
$('themeToggle').addEventListener('click', () => {
  night = !night;
  applyTheme(night);
  try { localStorage.setItem('newstide-theme', night ? 'night' : 'day'); } catch {}
});

function applyLanguage() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => { const v = T()[el.dataset.i18n]; if (typeof v === 'string') el.textContent = v; });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = T()[el.dataset.i18nPlaceholder]; });
  $('ringTop').textContent = T().ringTop;
  $('ringBottom').textContent = T().ringBottom;
  $('langToggle').textContent = T().switchTo;
  $('langToggle').lang = lang === 'en' ? 'ru' : 'en';
  $('dateline').textContent = new Date().toLocaleDateString(T().locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  $('themeToggle').textContent = night ? T().day : T().night;
  $('price').textContent = T().priceStart;
  if (mode.public_live) $('demoBanner').textContent = T().bannerLive;
  else if (mode.replay) $('demoBanner').textContent = T().bannerReplay;
  if (lastMarket) renderMarket(lastMarket);
  if (last) showResult(last.r, last.plan, true);
}
$('langToggle').addEventListener('click', () => {
  lang = lang === 'en' ? 'ru' : 'en';
  try { localStorage.setItem('newstide-lang', lang); } catch {}
  applyLanguage();
});

// Coin suggestions
async function loadCoins() {
  coins = await (await fetch('/api/coins')).json();
  $('coinList').innerHTML = coins.map(c => `<option value="${c.symbol}">${c.name}</option>`).join('');
}

// Market tape (running line) and the two news columns
function quoteHtml(q) {
  const name = T().quoteNames[q.name] ?? q.name;
  if (q.change == null) return `<span class="quote">${escapeHtml(name)} <b>${T().noData}</b></span>`;
  const up = q.change >= 0;
  const ch = q.unit === 'pt' ? `${up ? '+' : ''}${q.change.toFixed(2)}` : `${up ? '+' : ''}${q.change.toFixed(1)}%`;
  return `<span class="quote">${escapeHtml(name)} <b>${escapeHtml(q.value)}</b> <span class="${up ? 'up-tick' : 'down-tick'}">${up ? '\u25B2' : '\u25BC'} ${ch}</span></span>`;
}
function briefs(list) {
  return list.map(n => `<li><details><summary><b>${escapeHtml(n.title)}</b><small data-more="${escapeHtml(T().readMore)}" data-close="${escapeHtml(T().close)}">${escapeHtml(n.source)}</small></summary><p>${escapeHtml(n.summary ?? '')}</p>${/^https?:\/\//i.test(n.link ?? '') ? `<a href="${escapeHtml(n.link)}" target="_blank" rel="noopener">${escapeHtml(T().fullStory)}</a>` : ''}</details></li>`).join('');
}
function renderMarket(m) {
  const quotes = m.quotes ?? [];
  const row = quotes.length ? quotes.map(quoteHtml).join('') : `<span class="quote">${T().quotesNoData}</span>`;
  // Two copies side by side so the line can loop without a gap.
  $('tapeTrack').innerHTML = `<div class="tape-run">${row}</div><div class="tape-run" aria-hidden="true">${row}</div>`;
  $('tapeTrack').style.setProperty('--tape-seconds', `${Math.max(30, quotes.length * 5)}s`);
  $('mkSample').hidden = !m.sample;
  $('today').innerHTML = briefs(m.today ?? []);
  $('week').innerHTML = briefs(m.week ?? []);
}
async function loadMarket() {
  try {
    lastMarket = await (await fetch('/api/market')).json();
    renderMarket(lastMarket);
  } catch {
    $('tapeTrack').innerHTML = `<div class="tape-run"><span class="quote">${T().quotesNoData}</span></div>`;
  }
}

// Torn newspaper edges: a slightly uneven outline, drawn once per page load.
function tearEdges() {
  // Gentle deckle: small, smooth irregularities, like newsprint torn along a fold.
  const pts = [];
  const edge = (n, depth, f) => {
    let prev = Math.random();
    for (let i = 0; i <= n; i++) {
      prev = prev * 0.6 + Math.random() * 0.4;
      pts.push(f(i / n, prev * depth));
    }
  };
  edge(70, 0.35, (t, d) => `${(t * 100).toFixed(2)}% ${d.toFixed(2)}%`);
  edge(90, 0.25, (t, d) => `${(100 - d).toFixed(2)}% ${(t * 100).toFixed(2)}%`);
  edge(70, 0.3, (t, d) => `${(100 - t * 100).toFixed(2)}% ${(100 - d).toFixed(2)}%`);
  edge(90, 0.25, (t, d) => `${d.toFixed(2)}% ${(100 - t * 100).toFixed(2)}%`);
  $('paper').style.clipPath = `polygon(${pts.join(',')})`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// Indicator View: pointing hand, stamp, engraving, edition name, page tint
const images = { up: 'img/bull.jpg', down: 'img/bear.jpg', sideways: 'img/hamster.jpg' };
const moods = { up: 'up', down: 'down', sideways: 'flat' };
// The model writes English and, on the live site, Russian too; older editions fall back to English.
const pick = (r, field) => (lang === 'ru' && r[`${field}_ru`]) || r[field];

function showResult(r, plan, reprint = false) {
  last = { r, plan };
  const t = T();
  $('verdict').textContent = pick(r, 'verdict');
  $('deck').textContent = `${t.planIs(plan)} ${t.fit[r.plan_fit]}`;
  $('sfNote').textContent = pick(r, 'spot_futures_note');
  $('hand').dataset.dir = r.direction;
  $('hand').alt = t.hand(r.direction);
  $('stamp').dataset.fit = r.plan_fit;
  $('stampWord').textContent = t.stamp[r.plan_fit];
  $('stamp').setAttribute('aria-label', `${t.ringTop}: ${t.stamp[r.plan_fit]} ${t.ringBottom}`);
  $('animal').src = images[r.direction];
  $('animal').alt = t.animals[r.direction];
  $('edition').textContent = t.editions[r.direction];
  $('quiet').hidden = r.direction !== 'sideways';
  $('quiet').textContent = t.quiet;

  $('missing').hidden = !r.missing_sources?.length;
  $('missing').textContent = r.missing_sources?.length ? t.unavailable(r.missing_sources.join(', ')) : '';
  $('xNote').hidden = r.x_connected;
  $('resultSample').hidden = !r.sample && !r.archived && !r.edition;
  if (r.sample) $('resultSample').textContent = t.sample;
  if (r.edition) {
    const time = new Date(r.edition.at).toLocaleTimeString(t.locale, { hour: '2-digit', minute: '2-digit' });
    $('resultSample').textContent = t.printed(time, r.edition.items, r.edition.model, r.edition.shared_minutes);
  }
  if (r.archived) {
    const d = new Date(r.archived.at).toLocaleDateString(t.locale, { day: 'numeric', month: 'long', year: 'numeric' });
    $('resultSample').textContent = t.archived(d, r.archived.items, r.archived.model) + (lang === 'ru' && !r.verdict_ru ? ` ${t.englishOnly}` : '');
  }

  // Editor's notes: the reasoning chain, closed by default
  const notes = r.notes ?? { chain: [], dispatches: [] };
  $('notes').open = false;
  $('notes').hidden = !notes.chain.length;
  $('chain').innerHTML = notes.chain
    .map(c => `<li>${escapeHtml((lang === 'ru' && c.step_ru) || c.step)} <span class="cites">${(c.cites ?? []).map(n => `[${Number(n) | 0}]`).join(' ')}</span></li>`).join('');
  $('cited').innerHTML = notes.dispatches
    .map(d => `<li><span class="cites">[${Number(d.n) | 0}]</span> ${escapeHtml(d.title)} <small>${escapeHtml(d.source)}</small></li>`).join('');

  $('paper').dataset.mood = moods[r.direction];
  const cost = r.cost?.usd ?? 0;
  if (!reprint) sessionSpend += cost;
  $('price').textContent = r.cost?.shared ? t.priceShared(money(cost))
    : r.cost?.archived ? t.priceArchived(money(cost))
    : t.priceSession(money(cost), money(sessionSpend));

  $('welcome').hidden = true;
  $('result').hidden = false;
}

// Countdown while the background is gathered (up to one minute)
let timer;
function startCountdown() {
  let left = 60;
  $('secs').textContent = left;
  $('waiting').hidden = false;
  timer = setInterval(() => {
    left = Math.max(0, left - 1);
    $('secs').textContent = left;
  }, 1000);
}
function stopCountdown() {
  clearInterval(timer);
  $('waiting').hidden = true;
}

$('askForm').addEventListener('submit', async e => {
  e.preventDefault();
  const form = new FormData(e.target);
  const coin = String(form.get('coin') ?? '').trim().toUpperCase();
  const plan = form.get('plan');
  const timeframe = form.get('timeframe');
  $('formError').textContent = '';
  if (!coins.some(c => c.symbol === coin)) return ($('formError').textContent = T().errCoin);
  if (!plan) return ($('formError').textContent = T().errPlan);
  if (!timeframe) return ($('formError').textContent = T().errTf);

  $('getData').disabled = true;
  $('welcome').hidden = true;
  $('result').hidden = true;
  $('resultError').hidden = true;
  $('paper').dataset.mood = 'none';
  $('edition').textContent = T().late;
  startCountdown();
  try {
    const ctrl = new AbortController();
    const cut = setTimeout(() => ctrl.abort(), 62000);
    const res = mode.public_live
      ? await fetch(`/api/edition?coin=${encodeURIComponent(coin)}&timeframe=${encodeURIComponent(timeframe)}`, { signal: ctrl.signal })
      : await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coin, plan, timeframe }),
          signal: ctrl.signal
        });
    clearTimeout(cut);
    const body = await res.json();
    if (!res.ok) throw Object.assign(new Error(body.error || T().errPrint), { reason: body.reason, demo: body.demo });
    if (mode.public_live) body.plan_fit = fitOf(plan, body.direction);
    showResult(body, plan);
  } catch (err) {
    const t = T();
    $('resultError').textContent = err.name === 'AbortError' ? t.errSlow
      : err.reason === 'limit' ? t.errLimit : err.reason === 'print' ? t.errPrintLive : err.message;
    // Out of free editions or the print run failed: point the reader to the archived demo.
    if (err.demo && /^https:\/\//.test(err.demo)) {
      const a = document.createElement('a');
      a.href = err.demo; a.textContent = t.demoLink; a.target = '_blank'; a.rel = 'noopener';
      $('resultError').append(' ', a);
    }
    $('resultError').hidden = false;
  } finally {
    stopCountdown();
    $('getData').disabled = false;
  }
});

$('coin').addEventListener('input', () => { $('formError').textContent = ''; });

tearEdges();
applyLanguage();
loadCoins();
loadMarket();
fetch('/api/mode').then(r => r.json()).then(m => {
  mode = m;
  $('demoBanner').hidden = !(m.replay || m.public_live);
  applyLanguage();
}).catch(() => {});

// The same rule as the server's Answer Checker: does the news direction agree with the plan?
const fitOf = (plan, direction) => direction === 'sideways' ? 'mixed' : (plan === 'long') === (direction === 'up') ? 'supports' : 'against';
