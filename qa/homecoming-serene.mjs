// HOMECOMING M1: execute shipped admission expressions, not copies.
// Browser counters cover scheduling; these checks do not judge musical taste.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { stripComments } from '../strip-comments.mjs';

const source = stripComments(readFileSync('src/systems.js', 'utf8'));
function condition(prefix) {
  const at = source.indexOf(prefix);
  assert(at >= 0, 'guard exists: ' + prefix);
  const start = source.indexOf('(', at);
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    if (source[i] === '(') depth++;
    if (source[i] === ')' && --depth === 0) return source.slice(start + 1, i);
  }
  throw Error('Unclosed guard');
}
function expression(pattern) {
  const match = source.match(pattern);
  assert(match, 'shipped expression: ' + pattern);
  return match[1];
}
const guards = {
  streetAnswer: condition('if (game.state.noSereneScore && sec'),
  walk: condition('if (game.state.noSereneScore && musBassIn'),
  pulse: condition('if (!serene && !musPal.band && musDrum'),
  ostinato: expression(/const oGate = ([^;]+);/),
  second: condition('if (!serene && played && sec'),
  breath: expression(/const brK = ([\s\S]+?);/),
  gap: expression(/musPluckAt \+= (rand\(musPal\.pluckA[\s\S]+?);/),
};
const q = vm.createContext({ game: { state: {} }, musBassIn: {}, musPal: { pluckA: 5, pluckB: 7 },
  musSleep: 0, musBreath: 1, musProg: 1, musDrum: true, musChaseT: 0,
  musStmt: null, musOstArmed: true, played: true, sec: {}, musCurChord: [60],
  musIntensity: 0, sysMUS_LAYER_WALK: 2 / 3, sysMUS_LAYER_PULSE: .5,
  sysMUS_2ND_AT: 1 / 3, sysMUS_2ND_TIGHT: .3, sysMUS_BREATH_DIP: .3,
  clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)), rand: (a, b) => (a + b) / 2 });
const evaluate = key => vm.runInContext(guards[key], q);
let checks = 0;
function check(value, message) { assert(value, message); checks++; }
for (const rung of [0, 1, 2, 3]) {
  for (const cut of [false, true]) {
    Object.assign(q.game.state, { perfRung: rung, noSereneScore: cut });
    vm.runInContext(expression(/const serene = ([^;]+);/).replace(/^/, 'serene = '), q);
    q.musProg = 1; q.musStmt = null;
    for (const key of ['walk', 'pulse', 'ostinato', 'second', 'streetAnswer']) {
      check(!!evaluate(key) === cut, key + ' full progress, cut=' + cut + ', rung=' + rung);
    }
    check(evaluate('breath') === 1, 'wandering lead retained');
    check(Math.abs(evaluate('gap') - (cut ? 4.2 : 6)) < 1e-9, 'no progress acceleration');
    q.musStmt = {};
    check(evaluate('breath') === (cut ? .35 : 0), 'statement foreground reserved');
    check(!evaluate('ostinato'), 'statement never competes with ostinato');
    q.musStmt = null; q.musProg = 0;
    for (const key of ['walk', 'pulse', 'second']) check(!evaluate(key), key + ' absent at arrival');
    check(evaluate('gap') === 6, 'arrival timing unchanged');
  }
}
q.game.state.noSereneScore = true; q.serene = false; q.musProg = 1;
q.game.state.noArc = true;
check(!evaluate('walk'), 'inherited noArc cut respected');
q.game.state.noArc = false; q.musPal.band = 'salsa';
check(!evaluate('walk') && !evaluate('pulse'), 'band excluded from pad-only layers');
q.musPal.band = null; q.musChaseT = 1;
check(!evaluate('pulse'), 'chase owns its pulse');
console.log('HOMECOMING serene: ' + checks + ' admission checks pass; listening not assessed.');
