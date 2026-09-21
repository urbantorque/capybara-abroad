// Unit fixture for the journey's extracted Pasto retry controller. It drives
// the real execute/flyPasto source with declared harness/state stubs, not flight physics.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripComments } from '../strip-comments.mjs';

const source = stripComments(readFileSync(new URL('./reimagine-journey-chain.mjs', import.meta.url), 'utf8'));
function extract(name) {
  const m = source.match(new RegExp('^async function ' + name + '\\(', 'm'));
  assert.ok(m, 'source helper ' + name);
  const open = source.indexOf('{', m.index); let depth = 0, quote = '', esc = false;
  for (let i = open; i < source.length; i++) {
    const c = source[i];
    if (quote) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === quote) quote = ''; }
    else if ('\'"`'.includes(c)) quote = c;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return source.slice(m.index, i + 1);
  }
  throw Error('unclosed ' + name);
}
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const executeSource = extract('execute'), flySource = extract('flyPasto');

async function scenario(plan, expectedCalls, expectedError = null) {
  const report = { stages: [] }, artifacts = [], driverErrors = [];
  const oldWindow = globalThis.window, oldDocument = globalThis.document;
  const hadWindow = Object.hasOwn(globalThis, 'window'), hadDocument = Object.hasOwn(globalThis, 'document');
  globalThis.window = { __capy: { biome: { current: 'pasto' }, state: { paused: false },
    condor: { mounted: false }, capy: { carriedBy: null, grounded: true, swimming: false },
    taskDone: () => !!plan.earned } };
  globalThis.document = { hidden: false };
  let waits = 0;
  const root = { metadata: { errors: plan.runtime ? ['pageerror: fixture'] : [] }, page: { evaluate: async fn => fn(),
    waitForFunction: async fn => { waits++; if (plan.timeout) throw new Error('landing timeout');
      const g = globalThis.window.__capy, d = globalThis.document;
      for (const bad of [{ paused: true }, { hidden: true }, { carried: true }, { mounted: true }, { grounded: false }, { pasto: false }]) {
        g.state.paused = !!bad.paused; d.hidden = !!bad.hidden; g.capy.carriedBy = bad.carried ? {} : null;
        g.condor.mounted = !!bad.mounted; g.capy.grounded = bad.grounded !== false; g.capy.swimming = false;
        g.biome.current = bad.pasto === false ? 'sydney' : 'pasto';
        assert.equal(!!fn(), false, 'retry landing predicate rejects ' + Object.keys(bad)[0]);
      }
      g.state.paused = false; d.hidden = false; g.capy.carriedBy = null; g.condor.mounted = false;
      g.capy.grounded = false; g.capy.swimming = true; g.biome.current = 'pasto'; assert.ok(fn(), 'swimming is a valid landing state');
      g.capy.grounded = true; g.capy.swimming = false;
      assert.ok(fn()); } },
    result: async (name) => artifacts.push(name),
    close: async () => {} };
  const harnessFor = stage => { report.stages.push({ stage, stats: {} }); return { result: async name => artifacts.push('reimagine-journey-chain-test-' + stage + '-' + name),
    screenshot: async name => artifacts.push('reimagine-journey-chain-test-' + stage + '-' + name + '.png') };
  };
  let calls = 0;
  const driver = { url: 'fixture://boarding', run: async (...args) => {
    const h = args[3]; calls++;
    const outcome = plan.outcomes[calls - 1];
    assert.ok(['loss','other','other-assert','success'].includes(outcome), 'unexpected extra attempt');
    await h.result(outcome === 'success' ? 'success' : 'failure', {});
    if (outcome === 'loss') { const e = plan.errors?.[calls - 1] || new assert.AssertionError({ message: 'steered signature remains mounted' });
      if (plan.errors) plan.errors[calls - 1] = e; driverErrors[calls - 1] = e; throw e; }
    if (outcome === 'other' || outcome === 'other-assert') {
      const e = outcome === 'other' ? new Error('unrelated driver assertion') : new assert.AssertionError({ message: 'different assertion' });
      driverErrors[calls - 1] = e; throw e;
    }
    return true;
  } };
  const execute = new AsyncFunction('driver','stage','argv','assert','readFileSync','vm','harnessFor','report','current','root','data',executeSource + '\nreturn execute(driver, stage, argv);');
  const flyPasto = new AsyncFunction('driver','execute','assert','root','report','current','prefix',flySource + '\nreturn flyPasto(driver);');
  const executeBound = (driverArg, stage, argv) => execute(driverArg, stage, argv, assert, readFileSync, {}, harnessFor, report, 'pasto', root, {});
  const run = () => flyPasto(driver, executeBound, assert, root, report, 'pasto', 'reimagine-journey-chain-test');
  try {
    if (expectedError) {
      if (typeof expectedError === 'object') await assert.rejects(run, error => error === expectedError);
      else if (plan.exactThird) await assert.rejects(run, error => error === plan.errors[2]);
      else await assert.rejects(run, error => error.message.includes(expectedError));
    } else await run();
    assert.equal(calls, expectedCalls);
    assert.ok(report.stages.every(stage => Number.isFinite(stage.elapsedMs)), 'elapsed recorded');
    assert.ok(report.stages.every(stage => stage.elapsedMs >= 0), 'elapsed nonnegative');
    assert.ok(artifacts.every(name => name.startsWith('reimagine-journey-chain-test')), 'fixture artifact prefix: ' + JSON.stringify(artifacts));
    for (let i = 0; i < report.stages.length; i++)
      assert.equal(report.stages[i].failure, driverErrors[i] ? String(driverErrors[i].stack || driverErrors[i]) : undefined,
        'execute alone preserves the exact original driver failure, including before a retry timeout');
    if (plan.runtime) assert.equal(waits, 0, 'runtime errors fail before landing wait');
    return { calls, stages: report.stages.length, artifacts, waits, runtimeErrors: root.metadata.errors.length };
  } finally {
    if (hadWindow) globalThis.window = oldWindow; else delete globalThis.window;
    if (hadDocument) globalThis.document = oldDocument; else delete globalThis.document;
  }
}

const first = await scenario({ outcomes: ['success'] }, 1);
const retry = await scenario({ loss: true, outcomes: ['loss', 'success'] }, 2);
const third = { loss: true, exactThird: true, errors: [], outcomes: ['loss', 'loss', 'loss'] };
await scenario(third, 3, 'steered signature remains mounted');
await scenario({ loss: true, outcomes: ['loss'], timeout: true }, 1, 'landing timeout');
await scenario({ loss: true, assertEvidence: false, outcomes: ['loss'], earned: true }, 1, 'retry only before');
await scenario({ outcomes: ['other'] }, 1, 'unrelated driver assertion');
await scenario({ outcomes: ['other-assert'] }, 1, 'different assertion');
await scenario({ loss: true, runtime: true, assertEvidence: false, outcomes: ['loss'] }, 1, 'no runtime error hidden');
assert.equal(first.calls, 1); assert.equal(retry.calls, 2);
assert.equal(third.errors.length, 3);

// Journey acceptance follows the awarded river finish; the independent river
// beauty/control probe still requires every bonus gate and its chute capture.
const kyoto = stripComments(readFileSync(new URL('./reimagine-natural-kyoto.mjs', import.meta.url), 'utf8'));
const riverStart = kyoto.indexOf("assert.equal(runEnd.run.done,true,'authored river finish awarded');");
const riverEnd = kyoto.indexOf('await walkTo({x:42,z:212})', riverStart);
assert.ok(riverStart >= 0 && riverEnd > riverStart);
assert.ok(source.includes("chapter==='kyoto'?['--journey']:[]"), 'only Kyoto receives the explicit journey mode');
const riverCheck = new Function('assert','runEnd','report','journeyMode', kyoto.slice(riverStart, riverEnd));
for (const mode of [true, false]) {
  assert.throws(() => riverCheck(assert, { run: { done: false, through: 3 } }, { chuteCapture: true }, mode),
    /authored river finish awarded/);
  riverCheck(assert, { run: { done: true, through: 3 } }, { chuteCapture: true }, mode);
}
const imperfect = { chuteCapture: false };
riverCheck(assert, { run: { done: true, through: 2 } }, imperfect, true);
assert.deepEqual(imperfect.riverQuality, { through: 2, chute: false, required: 'authored finish' });
assert.throws(() => riverCheck(assert, { run: { done: true, through: 2 } }, { chuteCapture: true }, false),
  /all three boat gates crossed/);
assert.throws(() => riverCheck(assert, { run: { done: true, through: 3 } }, { chuteCapture: false }, false),
  /actual chute launch observed/);
console.log(JSON.stringify({ pass: true, first, retry, checked: ['third error identity','runtime fatal before wait','generic and assertion fatal','landing timeout fatal','earned retry rejected','authored Kyoto finish in both modes','strict standalone bonus assertions retained','imperfect journey bonus results reported'] }));
