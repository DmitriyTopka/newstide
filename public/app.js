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

// Market line and the two news columns
function fmtChange(v) {
  const cls = v >= 0 ? 'up-tick' : 'down-tick';
  return `<span class="${cls}">${v >= 0 ? '+' : ''}${v.toFixed(1)}%</span>`;
}
function briefs(list) {
  return list.map(n => `<li><b>${escapeHtml(n.title)}</b><small>${escapeHtml(n.source)}</small></li>`).join('');
}
async function loadMarket() {
  try {
    const m = await (await fetch('/api/market')).json();
    $('mkBtc').innerHTML = m.btc ? `Bitcoin $${m.btc.usd.toLocaleString('en-US')} ${fmtChange(m.btc.change24h)}` : 'Bitcoin: no data';
    $('mkNdq').innerHTML = m.nasdaq ? `Nasdaq ${m.nasdaq.value.toLocaleString('en-US')} ${fmtChange(m.nasdaq.change)}` : 'Nasdaq: no data';
    $('mkSample').hidden = !m.sample;
    $('today').innerHTML = briefs(m.today ?? []);
    $('week').innerHTML = briefs(m.week ?? []);
  } catch {
    $('mkBtc').textContent = 'Bitcoin: no data';
    $('mkNdq').textContent = 'Nasdaq: no data';
  }
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

loadCoins();
loadMarket();
