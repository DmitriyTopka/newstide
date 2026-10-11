// Answer Checker: makes sure the model followed our rules before the page sees the answer.
const DIRECTIONS = ['up', 'down', 'sideways'];
const FITS = ['supports', 'mixed', 'against'];

export function expectedFit(plan, direction) {
  if (direction === 'sideways') return 'mixed';
  return (plan === 'long') === (direction === 'up') ? 'supports' : 'against';
}

export function check(answer, { plan, items }) {
  const problems = [];
  const fixed = structuredClone(answer);
  const numbers = new Set(items.map(it => it.n));

  if (!DIRECTIONS.includes(fixed.direction)) {
    problems.push(`direction "${fixed.direction}" is not allowed`);
    fixed.direction = 'sideways';
  }
  if (!FITS.includes(fixed.plan_fit)) problems.push(`plan_fit "${fixed.plan_fit}" is not allowed`);

  const fit = expectedFit(plan, fixed.direction);
  if (fixed.plan_fit !== fit) {
    problems.push(`plan_fit "${fixed.plan_fit}" disagrees with ${plan} + ${fixed.direction}; set to "${fit}"`);
    fixed.plan_fit = fit;
  }

  let verdict = String(fixed.verdict ?? '').replace(/[0-9]+(\.[0-9]+)?\s*%|%/g, '').replace(/\s+/g, ' ').trim();
  if (verdict !== String(fixed.verdict ?? '').trim()) problems.push('verdict contained a percent');
  const words = verdict.split(' ').filter(Boolean);
  if (words.length > 6) {
    problems.push(`verdict had ${words.length} words; trimmed to 6`);
    verdict = words.slice(0, 6).join(' ');
  }
  fixed.verdict = verdict || 'Neutral for now';

  const chain = Array.isArray(fixed.chain) ? fixed.chain : [];
  if (!chain.length) problems.push('chain is empty');
  chain.forEach((c, i) => {
    const cites = Array.isArray(c.cites) ? c.cites.map(Number) : [];
    const bad = cites.filter(n => !numbers.has(n));
    if (!cites.length) problems.push(`step ${i + 1} cites nothing`);
    if (bad.length) problems.push(`step ${i + 1} cites dispatches that do not exist: ${bad.join(', ')}`);
    c.cites = cites.filter(n => numbers.has(n));
  });
  fixed.chain = chain;
  const citesOk = chain.length > 0 && chain.every(c => c.cites.length > 0);

  return { answer: fixed, problems, citesOk };
}
