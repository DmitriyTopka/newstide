// NewsTide page logic: the form, the countdown, the Indicator View and the cost counter.

const $ = id => document.getElementById(id);
const money = usd => `$${usd.toFixed(3)}`;
let sessionSpend = 0;
let coins = [];

// Theme: the night edition is remembered per browser; nothing else is stored.
function applyTheme(night) {
  document.documentElement.dataset.theme = night ? 'night' : 'day';
  $('themeToggle').textContent = night ? 'Day edition' : 'Night edition';
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

$('dateline').textContent = new Date().toLocaleDateString('en-US', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});

// Coin suggestions
async function loadCoins() {
  coins = await (await fetch('/api/coins')).json();
  $('coinList').innerHTML = coins.map(c => `<option value="${c.symbol}">${c.name}</option>`).join('');
}

// Market tape (running line) and the two news columns
function quoteHtml(q) {
  const up = q.change >= 0;
  const ch = q.unit === 'pt' ? `${up ? '+' : ''}${q.change.toFixed(2)}` : `${up ? '+' : ''}${q.change.toFixed(1)}%`;
  return `<span class="quote">${escapeHtml(q.name)} <b>${escapeHtml(q.value)}</b> <span class="${up ? 'up-tick' : 'down-tick'}">${up ? '\u25B2' : '\u25BC'} ${ch}</span></span>`;
}
function briefs(list) {
  return list.map(n => `<li><details><summary><b>${escapeHtml(n.title)}</b><small>${escapeHtml(n.source)}</small></summary><p>${escapeHtml(n.summary ?? '')}</p>${n.link ? `<a href="${escapeHtml(n.link)}" target="_blank" rel="noopener">Read the full story</a>` : ''}</details></li>`).join('');
}
async function loadMarket() {
  try {
    const m = await (await fetch('/api/market')).json();
    const quotes = m.quotes ?? [];
    const row = quotes.length ? quotes.map(quoteHtml).join('') : '<span class="quote">Quotes: no data</span>';
    // Two copies side by side so the line can loop without a gap.
    $('tapeTrack').innerHTML = `<div class="tape-run">${row}</div><div class="tape-run" aria-hidden="true">${row}</div>`;
    $('tapeTrack').style.setProperty('--tape-seconds', `${Math.max(30, quotes.length * 5)}s`);
    $('mkSample').hidden = !m.sample;
    $('today').innerHTML = briefs(m.today ?? []);
    $('week').innerHTML = briefs(m.week ?? []);
  } catch {
    $('tapeTrack').innerHTML = '<div class="tape-run"><span class="quote">Quotes: no data</span></div>';
  }
}

// Torn newspaper edges: a slightly uneven outline, drawn once per page load.
function tearEdges() {
  const pts = [];
  const jag = (n, f) => { for (let i = 0; i <= n; i++) pts.push(f(i / n, Math.random())); };
  jag(60, (t, r) => `${(t * 100).toFixed(2)}% ${(r * 0.9).toFixed(2)}%`);
  jag(90, (t, r) => `${(100 - r * 0.8).toFixed(2)}% ${(t * 100).toFixed(2)}%`);
  jag(60, (t, r) => `${(100 - t * 100).toFixed(2)}% ${(100 - r * 0.7).toFixed(2)}%`);
  jag(90, (t, r) => `${(r * 0.8).toFixed(2)}% ${(100 - t * 100).toFixed(2)}%`);
  $('paper').style.clipPath = `polygon(${pts.join(',')})`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// Indicator View: arrow, signal, animal, page tint
const animals = {
  up: { file: 'img/bull.png', label: 'A smiling bull' },
  down: { file: 'img/bear.png', label: 'A cheerful bear' },
  sideways: { file: 'img/hamster.png', label: 'A hamster' }
};
const moods = { up: 'up', down: 'down', sideways: 'flat' };
const fitWords = { supports: 'The background supports your plan.', mixed: 'The background is mixed for your plan.', against: 'The background goes against your plan.' };

function showResult(r, plan) {
  $('verdict').textContent = r.verdict;
  $('deck').textContent = `Your plan: ${plan === 'long' ? 'Long' : 'Short'}. ${fitWords[r.plan_fit]}`;
  $('sfNote').textContent = r.spot_futures_note;
  $('arrow').dataset.dir = r.direction;
  $('signal').dataset.light = r.plan_fit;
  $('signal').setAttribute('aria-label', `Signal: ${r.plan_fit}`);
  const a = animals[r.direction];
  const plate = $('animal');
  plate.setAttribute('aria-label', a.label);
  plate.textContent = '';
  const img = new Image();
  img.onload = () => { plate.style.backgroundImage = `url(${a.file})`; };
  img.onerror = () => { plate.style.backgroundImage = ''; plate.textContent = `${a.label}, engraving to come`; };
  img.src = a.file;
  $('missing').hidden = !r.missing_sources?.length;
  $('missing').textContent = r.missing_sources?.length ? `Unavailable today: ${r.missing_sources.join(', ')}.` : '';
  $('xNote').hidden = r.x_connected;
  $('resultSample').hidden = !r.sample;
  $('paper').dataset.mood = moods[r.direction];

  const cost = r.cost?.usd ?? 0;
  sessionSpend += cost;
  $('price').textContent = `Price of this edition: ${money(cost)}. Spent this session: ${money(sessionSpend)}.`;

  $('result').hidden = false;
  $('story').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
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
  if (!coins.some(c => c.symbol === coin)) return ($('formError').textContent = 'Pick a coin from the list: ETH, SOL or AAVE.');
  if (!plan) return ($('formError').textContent = 'Choose Long or Short.');
  if (!timeframe) return ($('formError').textContent = 'Choose a timeframe.');

  $('getData').disabled = true;
  $('story').hidden = false;
  $('result').hidden = true;
  $('resultError').hidden = true;
  $('paper').dataset.mood = 'none';
  startCountdown();
  try {
    const ctrl = new AbortController();
    const cut = setTimeout(() => ctrl.abort(), 62000);
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coin, plan, timeframe }),
      signal: ctrl.signal
    });
    clearTimeout(cut);
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'The paper could not be printed.');
    showResult(body, plan);
  } catch (err) {
    $('resultError').textContent = err.name === 'AbortError' ? 'Took too long. Try again in a moment.' : err.message;
    $('resultError').hidden = false;
  } finally {
    stopCountdown();
    $('getData').disabled = false;
  }
});

$('coin').addEventListener('input', () => { $('formError').textContent = ''; });

tearEdges();
loadCoins();
loadMarket();
