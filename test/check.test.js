import { test } from 'node:test';
import assert from 'node:assert/strict';
import { check, expectedFit } from '../server/check.js';

const items = [1, 2, 3].map(n => ({ n, title: `t${n}` }));
const base = { direction: 'up', plan_fit: 'supports', verdict: 'Growth expected for ETH', spot_futures_note: 'x', chain: [{ step: 's', cites: [1, 2] }] };

test('light rule: plan and direction decide the stamp', () => {
  assert.equal(expectedFit('long', 'up'), 'supports');
  assert.equal(expectedFit('long', 'down'), 'against');
  assert.equal(expectedFit('short', 'down'), 'supports');
  assert.equal(expectedFit('short', 'up'), 'against');
  assert.equal(expectedFit('short', 'sideways'), 'mixed');
});

test('a wrong stamp is corrected and reported', () => {
  const r = check({ ...base, plan_fit: 'supports' }, { plan: 'short', items });
  assert.equal(r.answer.plan_fit, 'against');
  assert.ok(r.problems.some(p => p.includes('plan_fit')));
});

test('percent signs are removed from the verdict', () => {
  const r = check({ ...base, verdict: 'ETH up 62% likely' }, { plan: 'long', items });
  assert.ok(!r.answer.verdict.includes('%'));
  assert.ok(r.problems.some(p => p.includes('percent')));
});

test('verdict is cut to 6 words', () => {
  const r = check({ ...base, verdict: 'one two three four five six seven eight' }, { plan: 'long', items });
  assert.equal(r.answer.verdict.split(' ').length, 6);
});

test('citations to dispatches that do not exist are caught', () => {
  const r = check({ ...base, chain: [{ step: 's', cites: [2, 9] }, { step: 't', cites: [] }] }, { plan: 'long', items });
  assert.deepEqual(r.answer.chain[0].cites, [2]);
  assert.equal(r.citesOk, false);
  assert.ok(r.problems.some(p => p.includes('9')));
});

test('a clean answer passes untouched', () => {
  const r = check(base, { plan: 'long', items });
  assert.deepEqual(r.problems, []);
  assert.equal(r.citesOk, true);
});

import { safeLink } from '../server/collect.js';
test('only http and https links survive', () => {
  assert.equal(safeLink('https://cointelegraph.com/a'), 'https://cointelegraph.com/a');
  assert.equal(safeLink('javascript:alert(1)'), '');
  assert.equal(safeLink('data:text/html,x'), '');
  assert.equal(safeLink('not a url'), '');
});

test('citations are de-duplicated and sorted', () => {
  const r = check({ ...base, chain: [{ step: 's', cites: [3, 1, 3, 2] }] }, { plan: 'long', items });
  assert.deepEqual(r.answer.chain[0].cites, [1, 2, 3]);
});
