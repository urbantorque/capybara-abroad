// VM contract for the shipped GPU instrument. No browser or WebGL context.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync('qa/homecoming-gpu.mjs', 'utf8');
const at = source.indexOf('return h.page.evaluate(byPass => {');
assert(at >= 0, 'install callback exists');
const open = source.indexOf('{', at); let depth = 0, close = open;
for (; close < source.length; close++) {
  if (source[close] === '{') depth++;
  if (source[close] === '}' && --depth === 0) break;
}
const callbackText = source.slice(source.indexOf('byPass =>', at), close + 1);
assert(callbackText.includes('shadow: 0'), 'shadow counter shipped');
const install = vm.runInNewContext('(' + callbackText + ')');

function fixture({ available = true, renderImpl = null, shadowImpl = null } = {}) {
  let now = 0, next = 1, active = null;
  const begun = [], ended = [], deleted = [], queries = new Map();
  const ext = { TIME_ELAPSED_EXT: 1, GPU_DISJOINT_EXT: 2 };
  const gl = {
    QUERY_RESULT_AVAILABLE: 3, QUERY_RESULT: 4,
    getExtension() { return ext; }, isContextLost: () => false,
    getParameter(p) { return p === ext.GPU_DISJOINT_EXT ? false : 0; },
    createQuery() { const q = { id: next++ }; queries.set(q, { available, result: 2000000 }); return q; },
    beginQuery(_, q) { assert.equal(active, null, 'queries do not nest'); active = q; begun.push(q); },
    endQuery() { assert.notEqual(active, null, 'query ended'); ended.push(active); active = null; },
    getQueryParameter(q, p) { return p === gl.QUERY_RESULT_AVAILABLE ? queries.get(q).available : queries.get(q).result; },
    deleteQuery(q) { deleted.push(q); queries.delete(q); if (active === q) active = null; },
  };
  const g = { scene: {}, camera: {}, state: { time: 1, paused: false, perfRung: 0 },
    renderer: { getContext: () => gl, render: renderImpl || function () {}, shadowMap: { render: shadowImpl || function () {} } }, post: { render() {} } };
  const document = { hasFocus: () => true, hidden: false };
  const context = vm.createContext({ window: {}, document, performance: { now: () => (now += 1) }, gl });
  context.window.__capy = g;
  return { g, gl, context, install, begun, ended, deleted, queries, setAvailable(v) { for (const q of queries.values()) q.available = v; } };
}

function arm(f, byPass) {
  vm.runInContext('window.__arm = (' + callbackText + ');', f.context);
  // The callback expects window.__capy and closes over the VM globals.
  f.context.window.__mode = byPass;
  return vm.runInContext('window.__arm(window.__mode)', f.context);
}

let checks = 0;
const post = fixture();
const rawPost = post.g.post.render; arm(post, false);
for (let i = 0; i < 8; i++) post.g.post.render();
assert.equal(post.begun.length, 2, 'post admits every fourth tick'); checks++;
const postStopped = post.context.window.__homecomingGpu.stop();
assert.equal(post.g.post.render, rawPost, 'post mode restores post.render');
assert.equal(postStopped.samples.length, 2, 'post samples drain'); checks += 2;

const bound = fixture({ available: false }); arm(bound, false);
for (let i = 0; i < 100; i++) bound.g.post.render();
assert.equal(bound.begun.length, 12, 'pending query bound is twelve'); checks++;
const boundStopped = bound.context.window.__homecomingGpu.stop();
assert.equal(boundStopped.pendingDropped, 12, 'stop deletes undrained queries');
assert.equal(bound.deleted.length, 12, 'all pending queries deleted'); checks += 2;

const pass = fixture();
const rawRender = pass.g.renderer.render; arm(pass, true);
const mirrorScene = {};
for (const [scene, camera] of [[pass.g.scene, pass.g.camera], [pass.g.scene, mirrorScene], [mirrorScene, pass.g.camera]]) {
  for (let i = 0; i < 4; i++) pass.g.renderer.render(scene, camera);
}
const passStopped = pass.context.window.__homecomingGpu.stop();
assert.equal(pass.g.renderer.render, rawRender, 'pass mode restores renderer.render'); checks++;
assert.equal([...passStopped.samples].map(s => s.kind).join(','), 'world,mirror,post'); checks++;

let nestedReady = false, nestedOnce = true, outerCalls = 0;
const nested = fixture({ renderImpl(scene, camera) {
  if (nestedReady && ++outerCalls === 4 && nestedOnce) { nestedOnce = false; nested.g.renderer.render(scene, camera); }
} });
arm(nested, true); nestedReady = true;
for (let i = 0; i < 4; i++) nested.g.renderer.render(nested.g.scene, nested.g.camera);
assert.equal(nested.begun.length, 1, 'world admits one query after four calls'); checks++;
assert.equal(nestedOnce,false,'nested render actually runs during sampled call');
nested.context.window.__homecomingGpu.stop();

let shadowReady = false, shadowOnce = true, shadowCalls = 0;
const shadow = fixture({ shadowImpl(...args) {
  if (shadowReady && ++shadowCalls === 4 && shadowOnce) { shadowOnce = false; shadow.g.renderer.shadowMap.render(...args); }
} });
const rawShadow = shadow.g.renderer.shadowMap.render;
arm(shadow, 'shadows'); shadowReady = true;
for (let i = 0; i < 4; i++) shadow.g.renderer.shadowMap.render([],shadow.g.scene,shadow.g.camera);
for (let i = 0; i < 8; i++) shadow.g.renderer.shadowMap.render([],{},{});
const shadowStopped = shadow.context.window.__homecomingGpu.stop();
assert.equal(shadow.g.renderer.shadowMap.render, rawShadow, 'shadow mode restores shadowMap.render'); checks++;
assert.equal(shadowStopped.samples.map(s => s.kind).join(','), 'shadow', 'shadow mode samples outer calls only'); checks++;
assert.equal(shadowOnce,false,'nested shadow runs during active sample');

let throwCalls = 0;
const thrown = fixture({ renderImpl() { if (++throwCalls === 4) throw Error('render boom'); } }); arm(thrown, true);
let threw = false;
try { for (let i = 0; i < 4; i++) thrown.g.renderer.render(thrown.g.scene, thrown.g.camera); } catch { threw = true; }
assert.equal(threw, true, 'render exception rethrows');
assert.equal(thrown.ended.length, 1, 'render exception ends active query'); checks += 2;
thrown.context.window.__homecomingGpu.stop();

console.log('HOMECOMING GPU contract: ' + checks + ' checks pass.');
