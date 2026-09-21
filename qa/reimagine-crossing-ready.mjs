// Static checks for the crossing GPU-readiness fence. The helper is extracted
// from systems.js so the cases exercise the shipped status policy.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { stripComments } from '../strip-comments.mjs';

const source = readFileSync('src/systems.js', 'utf8');
const text = stripComments(source);
let assertions = 0, scenarios = 0;
const fail = (message) => { throw new Error(message); };
const expect = (value, message) => { assertions++; if (!value) fail(message); };
function extractFunction(code, name) {
  const start = code.indexOf(`function ${name}(`);
  expect(start >= 0, `missing ${name}`);
  const open = code.indexOf('{', start);
  let depth = 0, quote = '', escaped = false;
  for (let i = open; i < code.length; i++) {
    const c = code[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return code.slice(start, i + 1);
  }
  fail(`unterminated ${name}`);
}
function extractAssignedFunction(code, marker) {
  const start = code.indexOf(marker);
  expect(start >= 0, `missing ${marker}`);
  const open = code.indexOf('{', start);
  let depth = 0, quote = '', escaped = false;
  for (let i = open; i < code.length; i++) {
    const c = code[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return code.slice(start, i + 1);
  }
  fail(`unterminated ${marker}`);
}

const helper = extractFunction(text, 'sysCrossFence');
const actualWait = extractAssignedFunction(text, 'const wait = function ()');
const sandbox = vm.createContext({});
vm.runInContext(`${helper}; this.probe = sysCrossFence;`, sandbox);
const probe = sandbox.probe;
const makeGL = (statuses = []) => {
  const calls = { fence: 0, wait: 0, flush: 0, delete: 0 };
  let cursor = 0;
  const gl = {
    SYNC_GPU_COMMANDS_COMPLETE: 1, ALREADY_SIGNALED: 2,
    CONDITION_SATISFIED: 3, TIMEOUT_EXPIRED: 4, WAIT_FAILED: 5,
    fenceSync() { calls.fence++; return { id: calls.fence }; },
    clientWaitSync(sync, flags, timeout) {
      expect(flags === 0 && timeout === 0, 'GPU waits never block');
      calls.wait++; return statuses[Math.min(cursor++, statuses.length - 1)];
    },
    deleteSync() { calls.delete++; }, flush() { calls.flush++; },
    isContextLost() { return false; },
    calls,
  };
  return gl;
};
const state = (owner = 1) => ({ owner, sync: null, done: false, result: '' });
const run = (label, fn) => { scenarios++; try { fn(); } catch (error) { fail(`${label}: ${error.message}`); } };

run('first submit is nonblocking', () => {
  const gl = makeGL([2]); const st = state();
  expect(probe(gl, st, 1, 10, 100) === 'pending', 'submit not pending');
  expect(gl.calls.fence === 1 && gl.calls.flush === 1 && gl.calls.wait === 0, 'submit waited');
});
run('timeout then signal cleans once', () => {
  const gl = makeGL([4, 2]); const st = state();
  expect(probe(gl, st, 1, 10, 100) === 'pending', 'initial');
  expect(probe(gl, st, 1, 11, 100) === 'pending', 'timeout');
  expect(probe(gl, st, 1, 12, 100) === 'done', 'signal');
  expect(st.done && st.sync === null && gl.calls.delete === 1, 'cleanup');
});
run('wait failed and unsupported are safe', () => {
  const gl = makeGL([5]); const st = state();
  expect(probe(gl, st, 1, 1, 100) === 'pending', 'submit');
  expect(probe(gl, st, 1, 2, 100) === 'unsupported', 'wait failed');
  expect(gl.calls.delete === 1, 'failed fence leaked');
  const no = state(); expect(probe(null, no, 1, 1, 100) === 'unsupported', 'null context');
  const lost = makeGL(); lost.isContextLost = () => true;
  expect(probe(lost, state(), 1, 1, 100) === 'unsupported', 'lost context');
});
run('deadline cleans a pending fence', () => {
  const gl = makeGL([4]); const st = state();
  expect(probe(gl, st, 1, 1, 10) === 'pending', 'submit');
  expect(probe(gl, st, 1, 10, 10) === 'timeout', 'deadline');
  expect(st.done && gl.calls.delete === 1, 'deadline cleanup');
});
run('replacement owner makes old callback stale', () => {
  const gl = makeGL([4]); const old = state(1);
  expect(probe(gl, old, 1, 1, 100) === 'pending', 'old submit');
  expect(probe(gl, old, 2, 2, 100) === 'stale', 'stale result');
  expect(old.done && old.sync === null && gl.calls.delete === 1, 'stale cleanup');
  const fresh = state(2); expect(probe(gl, fresh, 2, 3, 100) === 'pending', 'new crossing blocked');
});

for (const method of ['fenceSync', 'flush', 'clientWaitSync']) run(method + ' exception releases safely', () => {
  const gl = makeGL([2]), st = state();
  if (method === 'clientWaitSync') expect(probe(gl, st, 1, 1, 100) === 'pending', 'fence submitted');
  gl[method] = () => { throw Error('controlled GL failure'); };
  expect(probe(gl, st, 1, 2, 100) === 'unsupported', 'exception falls back');
  expect(st.done && st.sync === null, 'exception leaves no live sync');
  expect(gl.calls.delete === (method === 'fenceSync' ? 0 : 1), 'created sync cleaned exactly once');
});
run('null sync falls back without polling', () => {
  const gl = makeGL(), st = state(); gl.fenceSync = () => null;
  expect(probe(gl, st, 1, 1, 100) === 'unsupported', 'null fence fallback');
  expect(st.done && gl.calls.wait === 0 && gl.calls.delete === 0, 'no invalid sync used');
});
run('context loss after submission cleans sync', () => {
  const gl = makeGL(), st = state(); probe(gl, st, 1, 1, 100);
  gl.isContextLost = () => true;
  expect(probe(gl, st, 1, 2, 100) === 'unsupported', 'lost submitted context fallback');
  expect(st.sync === null && gl.calls.delete === 1, 'lost sync cleaned');
});
run('both completion statuses are idempotent', () => {
  for (const status of [2, 3]) {
    const gl = makeGL([status]), st = state(); probe(gl, st, 1, 1, 100);
    expect(probe(gl, st, 1, 2, 100) === 'done', 'completion accepted');
    expect(probe(gl, st, 1, 3, 100) === 'done', 'repeat completion stable');
    expect(gl.calls.wait === 1 && gl.calls.delete === 1, 'no repeat poll/delete');
  }
});

function waitHarness(statuses) {
  const gl = makeGL(statuses);
  const context = vm.createContext({ gl });
  vm.runInContext(`${helper}
    let now = 0, releases = 0, sysFenceActive = 1;
    const performance = { now: () => now };
    const timers = [];
    const setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
    const game = { state: { frames: 0, renderHold: true } };
    const renderer = { getContext: () => gl };
    const fenceOwner = 1, heldAt = 0, frames0 = 0;
    const sysFADE_HOLD = 460, sysFADE_HOLD_MAX = 10000;
    const fenceDeadline = 10000, fenceState = { owner: 1, sync: null, done: false, result: '' };
    let fenceGL = null, fenceStarted = false;
    const release = () => { releases++; if (sysFenceActive === fenceOwner) sysFenceActive = 0; };
    ${actualWait}
    this.fire = () => wait();
    this.set = (t, floor) => { now = t; game.state.frames = floor ? 2 : 0; game.state.renderHold = !floor; };
    this.setState = (frames, hold) => { game.state.frames = frames; game.state.renderHold = hold; };
    this.stats = () => ({ releases, owner: sysFenceActive, fence: gl.calls.fence, wait: gl.calls.wait, delete: gl.calls.delete, done: fenceState.done, sync: fenceState.sync });
    this.supersede = () => { sysFenceActive = 2; };
  `, context);
  return context;
}

run('actual wait enforces floor, minimum hold, and pending fence', () => {
  const h = waitHarness([2]);
  h.set(400, false); h.fire();
  expect(h.stats().fence === 0 && h.stats().releases === 0, 'released before two frames');
  h.set(460, true); h.fire();
  expect(h.stats().fence === 1 && h.stats().releases === 0, 'released before fence');
  h.set(476, true); h.fire();
  expect(h.stats().releases === 1 && h.stats().delete === 1, 'signaled fence did not release');
});
run('actual wait holds through timeout and releases at deadline', () => {
  const h = waitHarness([4]);
  h.set(460, true); h.fire();
  h.set(9999, true); h.fire();
  expect(h.stats().releases === 0 && h.stats().wait === 1, 'timeout released early');
  h.set(10000, false); h.fire();
  expect(h.stats().releases === 1 && h.stats().done && h.stats().delete === 1, 'deadline did not clean/release');
});
run('ready GPU still respects minimum hold', () => {
  const h = waitHarness([2]); h.set(400, true); h.fire(); h.set(416, true); h.fire();
  expect(h.stats().done && h.stats().releases === 0, 'GPU completion cannot bypass minimum');
  h.set(460, true); h.fire(); h.fire();
  expect(h.stats().releases === 1 && h.stats().delete === 1, 'one release and cleanup');
});
run('render hold and draw count each block submission', () => {
  const h = waitHarness([2]); h.set(460, false); h.setState(2, true); h.fire();
  expect(h.stats().fence === 0, 'warm hold blocks despite submitted frames');
  h.setState(1, false); h.fire(); expect(h.stats().fence === 0, 'one draw is insufficient');
});
run('deadline releases even when no frame ever draws', () => {
  const h = waitHarness([]); h.set(10000, false); h.fire();
  expect(h.stats().releases === 1 && h.stats().fence === 0 && h.stats().delete === 0, 'bounded zero-frame fallback');
});
run('actual stale wait cleans old sync and leaves new owner', () => {
  const h = waitHarness([4]);
  h.set(460, true); h.fire();
  h.supersede(); h.set(476, true); h.fire();
  const s = h.stats();
  expect(s.delete === 1 && s.done && s.releases === 0, 'stale wait leaked or released');
  expect(s.owner === 2, 'stale timer preserves replacement owner');
});

for (const symbol of ['sysCrossFence', 'fenceSync', 'clientWaitSync', 'SYNC_GPU_COMMANDS_COMPLETE', 'drawn >= 2', 'sysFADE_HOLD_MAX', 'sysFenceActive !== fenceOwner', 'sysCrossFence(fenceGL, fenceState, sysFenceActive'])
  expect(text.includes(symbol), `integration symbol missing: ${symbol}`);
console.log(JSON.stringify({ pass: true, scenarios, assertions, scope: 'Extracted helper and wait closure; release body is a counted stub, not browser acceptance.' }));
