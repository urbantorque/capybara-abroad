// Static regression for the re-imagined rest camera gate.
//
// The helper is lifted from systems.js and executed in a tiny VM harness. This
// keeps the timing assertions on the shipped function instead of copying its
// policy into a second implementation. The integration checks below are text
// checks because the camera closure is intentionally not exported.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { stripComments } from '../strip-comments.mjs';

const src = readFileSync('src/systems.js', 'utf8');
const code = stripComments(src);
const fail = (msg) => { throw new Error(msg); };
const expect = (ok, msg) => { if (!ok) fail(msg); };

function extractFunction(text, name) {
  const start = text.indexOf(`function ${name}(`);
  expect(start >= 0, `missing ${name}`);
  const open = text.indexOf('{', start);
  let depth = 0, quote = null, esc = false;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return text.slice(start, i + 1);
  }
  fail(`unterminated ${name}`);
}

const helper = extractFunction(src, 'sysRestReady');
const ctx = {
  game: { state: { noRestRestraint: false, perfRung: 0, started: true } },
  photoOn: false,
  camHandT: 0,
  input: { action: false, honk: false, jump: false },
  calm: false,
};
const sandbox = vm.createContext(ctx);
vm.runInContext(`let restStillT = 0; function sysCalmOn() { return calm; } ${helper}; this.ready = sysRestReady; this.bank = () => restStillT;`, sandbox);
const ready = (dt, idle = true, owned = false) => sandbox.ready(dt, idle, owned);
const state = () => sandbox.bank();
const step = (seconds, idle = true, owned = false) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) ready(1 / 60, idle, owned);
};
const resetInputs = () => {
  ctx.photoOn = false; ctx.camHandT = 0;
  ctx.input.action = false; ctx.input.honk = false; ctx.input.jump = false;
  ctx.calm = false;
};
const check = (label, fn) => { try { fn(); } catch (e) { fail(`${label}: ${e.message}`); } };

check('default six-second bank', () => {
  resetInputs(); ctx.game.state.noRestRestraint = false; ctx.game.state.perfRung = 0;
  step(0.5); expect(state() < 1, 'banked too quickly');
  step(1.5); expect(!ready(0), 'fires at 2s');
  step(3.0); expect(!ready(0), 'fires at 5s');
  expect(!ready(1 / 60), 'fires before 6s');
  expect(ready(61 / 60), 'does not fire at 6s+');
  expect(state() >= 6, 'bank not retained');
});

for (const [label, mutate] of [
  ['movement', () => ready(0.1, false)],
  ['owned vehicle', () => ready(0.1, true, true)],
  ['photo', () => { ctx.photoOn = true; ready(0.1); }],
  ['manual camera', () => { ctx.photoOn = false; ctx.camHandT = 1; ready(0.1); }],
  ['action', () => { resetInputs(); ctx.input.action = true; ready(0.1); }],
  ['honk', () => { resetInputs(); ctx.input.honk = true; ready(0.1); }],
  ['jump', () => { resetInputs(); ctx.input.jump = true; ready(0.1); }],
  ['not started', () => { resetInputs(); ctx.game.state.started = false; ready(0.1); }],
]) {
  check(`${label} resets bank`, () => {
    resetInputs(); ctx.game.state.started = true;
    step(6.1); expect(state() >= 6, 'setup did not fill bank');
    mutate(); expect(state() === 0, `bank survived ${label}`);
  });
}

check('calm blocks ready', () => {
  resetInputs(); ctx.game.state.started = true; step(6.1);
  ctx.calm = true; expect(!ready(0), 'calm did not block');
  ctx.calm = false; expect(ready(0), 'bank was discarded by calm');
});

for (const [label, change] of [
  ['flag', () => { ctx.game.state.noRestRestraint = true; }],
  ['governor rung', () => { ctx.game.state.perfRung = 1; }],
]) {
  check(`${label} inherits and clears`, () => {
    resetInputs(); ctx.game.state.started = true; ctx.game.state.noRestRestraint = false; ctx.game.state.perfRung = 0;
    step(2); expect(state() > 0, 'setup bank missing');
    change(); expect(ready(0.016), 'inherited gate did not pass'); expect(state() === 0, 'inherited gate kept stale bank');
    ctx.game.state.noRestRestraint = false; ctx.game.state.perfRung = 0;
    expect(!ready(5.9), 'restored gate used stale bank'); expect(ready(0.1), 'restored gate did not refill');
  });
}

// Keep the helper wired into all camera consumers. The vehicle and collision
// priorities must remain separate gates, so this only looks for restReady in
// the four intended regions and does not accept a broad source-wide rewrite.
const region = (needle, span = 700) => {
  const at = code.indexOf(needle);
  expect(at >= 0, `missing integration ${needle}`);
  return code.slice(Math.max(0, at - Math.floor(span / 2)), at + Math.ceil(span / 2));
};
expect(/restReady/.test(region('camIdleT > sysFAR_GLANCE_IDLE_T')), 'far glance not rest-gated');
expect(/restReady/.test(region('restReady && started && !mounted')), 'idle yaw not rest-gated');
expect(/restReady/.test(region('const restAsk =')), 'rest ask not rest-gated');
expect(/restReady/.test(region('if (sysNapNow > 0.001)')), 'nap not rest-gated');
expect(/!mounted|sailing|rideYaw/.test(region('const restReady =')), 'vehicle priority was folded into helper');
expect(/camClearF < 0\.48/.test(region('const restAsk =', 700)), 'collision latch moved out of rest ask');

// The source-level reset hooks are deliberately explicit: C, pad-C, and a
// chapter teleport must all discard a partially earned uninterrupted bank.
expect(/KeyC[\s\S]{0,260}restStillT\s*=\s*0/.test(code), 'keyboard C does not reset rest bank');
expect(/const snap = padBtn[\s\S]{0,360}restStillT\s*=\s*0/.test(code), 'pad C does not reset rest bank');
expect(/function teleportCapy[\s\S]{0,520}restStillT\s*=\s*0/.test(code), 'teleport does not reset rest bank');

console.log(JSON.stringify({ ok: true, helper: 'sysRestReady', bank: state(), integrations: ['idleYaw', 'farGlance', 'restAsk', 'nap'] }));
