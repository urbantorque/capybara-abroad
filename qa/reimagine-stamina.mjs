// ROADMAP-REIMAGINE C1. Execute the shipped stamina block, cost statements
// and final publication. No renderer or reimplementation of the controller.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { stripComments } from '../strip-comments.mjs';

const src = stripComments(readFileSync('src/capybara.js', 'utf8'));
const constants = [...src.matchAll(/const (capy(?:STAM_[A-Z_]+|DRAIN_MOD_FLOOR|REGEN_MOD_CAP|CLIMB_STAM))\s*=\s*([^;]+);/g)]
  .map(m => m[0]).join('\n');
const begin = src.indexOf('const stamMag2 =');
const end = src.indexOf('if (capyJumpCool > 0)', begin);
assert.ok(begin >= 0 && end > begin);
const publish = src.match(/capy\.stamina = capyStam = clamp\(capyStam, 0, 1\);/)?.[0];
assert.ok(publish);
const hopCosts = [...src.matchAll(/capyStam -= capySTAM_HOP;\s*if \(capyStam < 0\) capyStam = 0;/g)].map(m => m[0]);
assert.equal(hopCosts.length, 2, 'both ordinary hop and wall kick have a paid cost');
const climbCost = src.match(/capyStam -= capyCLIMB_STAM[^;]+;\s*if \(capyStam < 0\) capyStam = 0;/)?.[0];
assert.ok(climbCost);
const helm = src.match(/capyStam = clamp\(capyStam \+ capySTAM_REGEN \* 0\.5[^;]+;/)?.[0];
assert.ok(helm);
const q = vm.createContext({ clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)),
  game: { weather: { mood: () => ({ cold: 1 }) }, sfx: () => {} },
  capyStam: 0.5, capyStamHold: 0, capyStamBlown: false, capySwimming: false,
  capyDiving: false, capyDiveGrace: 0, capyWorn: '', capyGrade: 0,
  capyEarFlick: 0, capyPop: 0, capySfxOpts: {}, dt: 1 / 60, into: 1,
  input: { x: 1, z: 0, run: true }, capySkill: { lungs: false },
  capy: { boon: null, carriedBy: null, atHelm: false, gullProof: 0,
    mods: { drainMul: 1, regenMul: 1, puffRegenSprint: 0, breathMul: 1 } } });
vm.runInContext(constants + '\nfunction step() {' + src.slice(begin, end) + publish + '}' +
  '\nfunction hop() {' + hopCosts[1] + publish + '}' +
  '\nfunction wallKick() {' + hopCosts[0] + publish + '}' +
  '\nfunction climb() {' + climbCost + publish + '}' +
  '\nfunction helmStep() {' + helm + publish + '}', q);
function reset({ drain = 1, regen = 1, lungs = false, bottomless = false, worn = '', boon = null, stamina = 0.5 } = {}) {
  q.capyStam = stamina; q.capyStamHold = 0; q.capyStamBlown = false;
  q.capySwimming = false; q.capyDiving = false; q.capyWorn = worn; q.dt = 1 / 60;
  q.capySkill.lungs = lungs; q.input = { x: 1, z: 0, run: true };
  Object.assign(q.capy, { boon: boon ? { id: boon, t: boon === 'thermos' ? 45 : 75, fresh: true } : null,
    carriedBy: null, atHelm: false, stamina,
    mods: { drainMul: drain, regenMul: regen, puffRegenSprint: bottomless ? 0.15 : 0, breathMul: 1 } });
}
const near = (a, b, message) => assert.ok(Math.abs(a - b) < 1e-10, message + ': ' + a + ' versus ' + b);
let checks = 0, matrixRows = 0;
function test(name, go) { go(); checks++; console.log('pass  ' + name); }

test('All purchase/skill combinations preserve ordinary sprint arithmetic', () => {
  for (const drain of [1, 0.88, 0.78, 0.70]) for (const regen of [1, 1.15, 1.30]) {
    for (const lungs of [false, true]) for (const bottomless of [false, true]) for (const worn of ['', 'scarf', 'parka']) {
      const row = { drain, regen, lungs, bottomless, worn };
      reset(row); q.step(); const baseline = q.capy.stamina;
      const use = 0.1 * drain * (lungs ? 0.71 : 1) * (worn === 'parka' ? 0.85 : 1);
      const gain = bottomless ? 0.265 * regen * (lungs ? 1.45 : 1) * 0.15 : 0;
      near(baseline, 0.5 + (gain - use) / 60, 'unchanged ordinary sprint');
      for (const boon of ['mango', 'second-wind']) {
        reset({ ...row, boon }); q.step();
        assert.ok(q.capy.stamina >= baseline, 'boon never worsens ' + JSON.stringify({ ...row, boon }));
        const multiplier = worn === 'scarf' ? 0.5 / 1.1 : 0.5;
        const fixedUse = Math.min(use, Math.max(use * multiplier, 0.025));
        near(q.capy.stamina, 0.5 + (gain - fixedUse) / 60, 'boon floor respects stronger purchases');
      }
      reset({ ...row, boon: 'thermos', stamina: 0.1 }); q.step();
      assert.equal(q.capy.stamina, 1, 'thermos refills and cannot overflow');
      near(q.capy.boon.t, 45 - 1 / 60, 'thermos duration unchanged');
      reset({ ...row, boon: 'quick' }); q.step();
      near(q.capy.stamina, baseline, 'quick has no stamina discount');
      matrixRows++;
    }
  }
});
test('Bottomless with lungs fills the bar but cannot store extra bars', () => {
  reset({ drain: 0.7, regen: 1.3, lungs: true, bottomless: true, stamina: 1 });
  for (let n = 0; n < 7200; n++) {
    q.step(); assert.equal(q.capyStam, 1); assert.equal(q.capy.stamina, 1);
  }
  q.capy.mods.puffRegenSprint = 0; q.capySkill.lungs = false; q.capy.mods.drainMul = 1;
  for (let n = 0; n < 60; n++) q.step();
  near(q.capy.stamina, 0.9, 'one second spends from one real bar');
});
test('Mango cannot weaken a stronger-than-floor existing modifier', () => {
  reset({ drain: 0.2, boon: 'mango' }); q.step();
  near(q.capy.stamina, 0.5 - 0.02 / 60, 'future stronger modifier is preserved');
});
test('Thermos expires into the ordinary drain on the expiry frame', () => {
  reset({ boon: 'thermos', stamina: 0.3 }); q.step();
  q.capy.boon.t = 1 / 120; q.step();
  assert.equal(q.capy.boon, null); near(q.capy.stamina, 1 - 0.1 / 60, 'normal drain resumes');
});
test('Diving keeps its breath cost, snorkel and purchased breath modifier', () => {
  for (const worn of ['', 'snorkel']) for (const breath of [1, 0.85]) for (const boon of [null, 'mango', 'thermos']) {
    reset({ worn, boon }); q.capyDiving = true; q.capy.mods.breathMul = breath; q.step();
    const initial = boon === 'thermos' ? 1 : 0.5;
    near(q.capy.stamina, initial - 0.062 * (worn === 'snorkel' ? 0.75 : 1) * breath / 60, 'breath cost unchanged');
  }
  reset({ stamina: 0.0001 }); q.capyDiving = true; q.step();
  assert.equal(q.capy.stamina, 0); assert.equal(q.capyDiving, false); assert.equal(q.capy.blown, true);
});
test('Surface swimming and being carried still restore stamina', () => {
  for (const mode of ['swim', 'carried']) {
    reset(); if (mode === 'swim') q.capySwimming = true; else q.capy.carriedBy = {};
    q.step(); near(q.capy.stamina, 0.5 + 0.265 / 60, mode + ' recovery');
  }
});
test('Walking recovery, delay and exhaustion recovery threshold are unchanged', () => {
  reset(); q.input.run = false; q.step();
  near(q.capy.stamina, 0.5 + 0.265 * 0.62 / 60, 'walking recovery');
  reset(); q.input.run = false; q.capyStamHold = 0.55; q.step();
  near(q.capy.stamina, 0.5, 'delay still prevents recovery');
  reset({ stamina: 0.29 }); q.input.run = false; q.capyStamBlown = true; q.step();
  assert.equal(q.capy.blown, true);
  q.capyStam = 0.3; q.step(); assert.equal(q.capy.blown, false);
});
test('Jump, wall kick and climb costs publish the paid amount in the same frame', () => {
  for (const cost of ['hop', 'wallKick']) {
    reset({ stamina: 1 }); q[cost](); near(q.capy.stamina, 0.89, cost + ' costs 0.11');
    reset({ stamina: 0.01 }); q[cost](); assert.equal(q.capy.stamina, 0);
  }
  reset(); q.climb(); near(q.capy.stamina, 0.5 - 0.042 / 60, 'climb cost unchanged');
  reset({ stamina: 0.0001 }); q.climb(); assert.equal(q.capy.stamina, 0);
});
test('All final publication paths bound authoritative and visible stamina', () => {
  for (const initial of [-1, 2]) for (const mode of ['step', 'hop', 'wallKick', 'climb', 'helmStep']) {
    reset({ stamina: initial }); q[mode]();
    assert.ok(q.capyStam >= 0 && q.capyStam <= 1, mode + ' private bank');
    assert.equal(q.capy.stamina, q.capyStam, mode + ' published bank');
  }
});
test('Helm recovery retains its ordinary and ferry-cap rates', () => {
  for (const worn of ['', 'ferrycap']) {
    reset({ worn }); q.helmStep();
    near(q.capy.stamina, 0.5 + 0.265 * 0.5 * (worn === 'ferrycap' ? 2 : 1) / 60, 'helm rate');
  }
});
console.log('\n' + checks + ' behavioral groups passed; ' + matrixRows + ' purchase/skill/wardrobe combinations.');
