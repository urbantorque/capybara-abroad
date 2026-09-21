import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripComments } from '../strip-comments.mjs';

const raw = readFileSync(new URL('../src/npc.js', import.meta.url), 'utf8');
const source = stripComments(raw);
function authoredNumber(name) {
  const m = source.match(new RegExp(`const\\s+${name}\\s*=\\s*([^;]+)`));
  assert.ok(m, `missing authored ${name}`);
  return Number(m[1]);
}
function authoredBranch() {
  const m = source.match(/if\s*\(r\.trav\)\s*\{\s*if\s*\(game\.state\s*&&\s*game\.state\.paused\)/);
  assert.ok(m, 'missing traveller action branch');
  const start = m.index;
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  assert.fail('unclosed traveller action branch');
}
const MET = authoredNumber('npcTRAV_MET_R');
const HOLD = authoredNumber('npcTRAV_GIFT_HOLD');
assert.equal(MET, 3.2);
assert.equal(HOLD, 1.2);
const runBranch = new Function(
  'r', 'game', 'd2', 'dt', 'localLine', 'npcTRAV_GIFT_LINES',
  'npcTRAV_MET_R', 'npcTRAV_GIFT_HOLD', authoredBranch(),
);
let checks = 2;
let scenarios = 0;
function check(value, expected, label) {
  checks += 1;
  assert.deepEqual(value, expected, label);
}
function env({ reachable = true, action = false, eGiftT = -1, paused = false,
  capy = {}, time = 10, noTime = false, dt = 0.6 } = {}) {
  const calls = { gift: 0, open: 0, line: 0 };
  const r = { trav: true, biome: 'hanoi', eGiftT };
  const game = {
    state: { paused, time }, input: { action }, capy,
    bagGift() { calls.gift += 1; },
    bagOpen() { calls.open += 1; },
  };
  if (noTime) delete game.state.time;
  const step = (patch = {}) => {
    Object.assign(game.input, 'action' in patch ? { action: patch.action } : {});
    if ('capy' in patch) game.capy = patch.capy;
    if ('time' in patch) game.state.time = patch.time;
    if ('paused' in patch) game.state.paused = patch.paused;
    runBranch(r, game, reachable ? 0 : MET * MET + 1, dt,
      () => { calls.line += 1; }, [], MET, HOLD);
  };
  return { calls, game, r, step };
}
scenarios += 1;
{
  const f = env({ capy: { heldProp: { id: 'bowl' } }, action: true });
  f.step(); f.step(); f.step();
  check(f.calls, { gift: 0, open: 0, line: 0 }, 'held prop tap/longhold');
}
scenarios += 1;
{
  const f = env({ eGiftT: 0, capy: { heldProp: null, threwAt: 10 }, action: false });
  f.step();
  check(f.calls, { gift: 0, open: 0, line: 0 }, 'throw release frame');
  f.step({ time: 11, action: true });
  f.step({ action: false });
  check(f.calls, { gift: 0, open: 1, line: 0 }, 'next independent tap');
}
scenarios += 1;
{
  const f = env({ capy: { heldProp: null }, action: true });
  f.step();
  f.step({ capy: { heldProp: { id: 'bowl' } } });
  f.step({ capy: { heldProp: null } });
  check(f.calls, { gift: 0, open: 0, line: 0 }, 'lost prop remains suppressed');
  f.step({ action: false });
  f.step({ action: true });
  f.step({ action: false });
  check(f.calls, { gift: 0, open: 1, line: 0 }, 'key-up permits next tap');
}
scenarios += 1;
{
  const f = env({ capy: { heldProp: null }, action: true, dt: HOLD / 2 });
  f.step(); f.step(); f.step(); f.step();
  check(f.calls, { gift: 1, open: 0, line: 1 }, 'ordinary hold gift once');
  f.step({ action: false });
  check(f.calls, { gift: 1, open: 0, line: 1 }, 'gift release no bag');
}
scenarios += 1;
{
  const f = env({ eGiftT: 0, action: false, reachable: false });
  f.step();
  f.step({ action: false });
  check(f.calls, { gift: 0, open: 0, line: 0 }, 'out-of-reach cancel');
  const p = env({ eGiftT: 0, paused: true });
  p.step();
  check(p.r.eGiftT, -1, 'paused reset');
}
scenarios += 1;
{
  const noCapy = env({ eGiftT: 0, capy: undefined, action: false });
  noCapy.game.capy = undefined;
  assert.doesNotThrow(() => noCapy.step(), 'undefined capy');
  check(noCapy.calls.open, 1, 'undefined capy opens');
  const stale = env({ eGiftT: 0, capy: { heldProp: null, threwAt: 9 }, action: false, noTime: true });
  stale.step();
  check(stale.calls.open, 1, 'stale throw with undefined current time');
}

console.log(JSON.stringify({ pass: true, scenarios, checks, authored: { metRadius: MET, holdSeconds: HOLD } }));
