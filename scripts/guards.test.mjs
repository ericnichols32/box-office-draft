import { grossDecision, budgetDecision } from './update-box-office.mjs';
import assert from 'node:assert/strict';

const cases = [];
const t = (name, fn) => { try { fn(); cases.push(['PASS', name]); } catch (e) { cases.push(['FAIL', name + ' — ' + e.message]); } };

// ── The Masters of the Universe scenario: a flop reported as "no data" ──
t('a flop reported as null never wipes a real gross', () => {
  assert.equal(grossDecision(113.8, null, 1).accept, false);
});
t('first real value for an unreleased film is accepted', () => {
  assert.equal(grossDecision(null, 113.8, 1).accept, true);
});

// ── Rule 2: gross never decreases ──
t('a lower gross is rejected (domestic mistaken for worldwide)', () => {
  const d = grossDecision(2333.0, 891.5, 1);
  assert.equal(d.accept, false);
  assert.equal(d.reason, 'gross-decreased');
});
t('normal daily growth is accepted', () => {
  assert.equal(grossDecision(500, 530, 1).accept, true);
});
t('growth after a long gap is accepted', () => {
  assert.equal(grossDecision(500, 1200, 7).accept, true); // 700 over 7d = 100/d
});

t('infobox rounding is absorbed silently, not flagged', () => {
  assert.equal(grossDecision(1136.4, 1136, 1).reason, 'rounding');
  assert.equal(grossDecision(231.5, 231.4, 1).reason, 'rounding');
});
t('a real drop is still caught despite the tolerance', () => {
  assert.equal(grossDecision(2333, 891.5, 1).reason, 'gross-decreased');
});

// ── Implausible jumps are held, not written ──
t('an absurd one-day jump is rejected', () => {
  const d = grossDecision(200, 1500, 1);
  assert.equal(d.accept, false);
  assert.equal(d.reason, 'gross-jump');
});
t('a >2.5x multiplier is rejected even within the daily cap', () => {
  const d = grossDecision(10, 120, 30); // small abs jump, 12x multiplier
  assert.equal(d.accept, false);
  assert.equal(d.reason, 'gross-jump');
});

// ── Budgets ──
t('a small budget revision is accepted', () => {
  assert.equal(budgetDecision(200, 210).accept, true);
});
t('a large budget swing is held for review', () => {
  const d = budgetDecision(160, 200); // the Michael case: +25%
  assert.equal(d.accept, false);
  assert.equal(d.reason, 'budget-swing');
});
t('an 18% swing is held (the Spider-Man correction)', () => {
  assert.equal(budgetDecision(275, 225).reason, 'budget-swing');
});
t('a first budget for a film with none is accepted', () => {
  assert.equal(budgetDecision(null, 45).accept, true);
});
t('null budget never overwrites a known one', () => {
  assert.equal(budgetDecision(170, null).accept, false);
});

for (const [status, name] of cases) console.log(`${status === 'PASS' ? '✓' : '✗'} ${name}`);
const failed = cases.filter(([s]) => s === 'FAIL').length;
console.log(`\n${cases.length - failed}/${cases.length} passed`);
process.exit(failed ? 1 : 0);
