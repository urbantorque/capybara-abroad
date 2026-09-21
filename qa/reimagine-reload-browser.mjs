// Repeated real reload/start lifecycle in one fresh, owned headful browser.
// Usage: node qa/reimagine-reload-browser.mjs [cycles=12] [tag=first]
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { freemem, totalmem } from 'node:os';
import { openHarness, CHAPTERS } from './reimagine-harness.mjs';

const args = process.argv.slice(2), cycles = args[0] === undefined ? 12 : Number(args[0]), tag = args[1] || 'first';
assert.ok(args.length <= 2 && Number.isInteger(cycles) && cycles >= 1 && cycles <= 20, 'cycles must be 1–20');
assert.match(tag, /^[\w-]+$/);
const name = 'reimagine-reload-' + tag, settleMs = 2500;
const hashes = Object.fromEntries(['../src/systems.js', '../src/main.js', './reimagine-harness.mjs'].map(file =>
  [file, createHash('sha256').update(readFileSync(new URL(file, import.meta.url))).digest('hex')]));
const pinRung = process.env.CAPY_QA_PIN_RUNG === '1';
const chapter = process.env.CAPY_QA_RELOAD_CHAPTER || 'sydney';
assert.ok(CHAPTERS.includes(chapter), 'known reload chapter');
const h = await openHarness({ pinRung });
const report = { metadata: h.metadata, hashes, cycles, settleMs, pinRung, chapter, rows: [], events: [], capabilities: {},
  scope: 'One fresh headful browser/context/save; actual page.reload and normal startup with trusted Shift, then 2.5 seconds real-clock settling. Optional public chapter-arrival fixture and full-fidelity preference only; no task/body/input/journey-save seeding, forced GC, special launch flags or frame-time benchmark.',
  memoryScope: 'CDP target JS heap and DOM counters plus Three.js resource counts. Node os.freemem is system-wide available memory, not this browser process. None of these measures GPU allocation or browser process RSS; a trend does not establish crash cause.' };
let cdp, crashed = false, stage = 'setup', cycle = 0;
h.page.on('crash', () => { crashed = true; report.events.push({ kind: 'crash', cycle, stage, at: new Date().toISOString() }); });
h.browser.on('disconnected', () => report.events.push({ kind: 'browser disconnected', cycle, stage, at: new Date().toISOString() }));
const hostMemory = () => ({ freeBytes: freemem(), totalBytes: totalmem() });
async function checkpoint() { await h.result(name, report); }
async function cdpRead(method) {
  if (!cdp) return { unavailable: 'No CDP target session' };
  try { return await cdp.send(method); } catch (error) { return { unavailable: String(error.message || error) }; }
}
async function snapshot(label) {
  const row = { cycle, label, at: new Date().toISOString(), hostMemory: hostMemory(), errors: h.metadata.errors.slice() };
  report.rows.push(row);
  const perf = await cdpRead('Performance.getMetrics');
  row.performance = perf.unavailable ? perf : Object.fromEntries(
    ['JSHeapUsedSize', 'JSHeapTotalSize', 'Documents', 'Nodes'].map(key =>
      [key, perf.metrics?.find(m => m.name === key)?.value ?? null]));
  row.dom = await cdpRead('Memory.getDOMCounters');
  row.game = await h.page.evaluate(() => {
    const g = window.__capy, b = g.capy.body, info = g.renderer.info;
    const saved = localStorage.getItem('capy3.journey.v1');
    return { started: !!g.state.started, paused: !!g.state.paused, hidden: document.hidden,
      chapter: g.biome.current, time: g.state.time, rung: g.state.perfRung, lastError: g.state.lastError || null,
      body: { p: b.position.toArray(), v: b.velocity.toArray(), quaternion: b.quaternion.toArray() },
      renderer: { memory: { ...info.memory }, calls: info.render.calls, triangles: info.render.triangles,
        programs: info.programs?.length ?? null },
      save: saved === null ? null : JSON.parse(saved), keys: window.__reloadKeys || [] };
  });
  return row;
}
function healthy(row) {
  const s = row.game;
  assert.equal(crashed, false, 'owned page has not crashed');
  assert.equal(s.started, true, 'actual game started');
  assert.equal(s.hidden, false, 'owned page visible');
  assert.equal(s.paused, false, 'actual game unpaused');
  assert.equal(s.chapter, chapter, 'reload probe stays in selected chapter');
  assert.ok(Number.isFinite(s.time), 'finite clock');
  assert.ok([...s.body.p, ...s.body.v, ...s.body.quaternion].every(Number.isFinite), 'finite body');
  assert.equal(s.lastError, null); assert.deepEqual(h.metadata.errors, [], 'zero runtime errors');
}
async function startAndSettle() {
  await h.page.waitForFunction(() => !!window.__capy && !!(document.querySelector('.capyui-carry') || document.querySelector('.capyui-go')));
  await h.page.evaluate(() => {
    window.__reloadKeys = [];
    for (const type of ['keydown', 'keyup']) document.addEventListener(type, e =>
      window.__reloadKeys.push({ type, key: e.code, trusted: e.isTrusted }));
  });
  stage = 'start'; await h.start();
  stage = 'selected chapter'; await h.arrive(chapter);
  const beforeTime = await h.page.evaluate(() => window.__capy.state.time), at = performance.now();
  stage = 'settle'; await h.page.waitForTimeout(settleMs);
  const row = await snapshot(cycle ? 'after reload' : 'initial startup');
  row.settle = { realMs: performance.now() - at, beforeTime, afterTime: row.game.time };
  healthy(row);
  assert.ok(row.settle.realMs >= settleMs - 10, 'full real-clock settle');
  assert.ok(row.game.time > beforeTime, 'game clock advances after startup');
  assert.ok(row.game.keys.some(k => k.key === 'ShiftLeft' && k.type === 'keydown' && k.trusted), 'trusted startup Shift observed');
  assert.ok(row.game.keys.every(k => k.trusted), 'recorded input trusted');
  return row;
}
try {
  cdp = await h.context.newCDPSession(h.page);
  try { await cdp.send('Performance.enable'); report.capabilities.performanceEnabled = true; }
  catch (error) { report.capabilities.performanceEnabled = false; report.capabilities.performanceError = String(error.message || error); }
  assert.equal(await h.page.evaluate(() => localStorage.getItem('capy3.journey.v1')), null, 'fresh journey save, no seed');
  await snapshot('initial before startup'); await checkpoint(); await startAndSettle(); await checkpoint();
  for (cycle = 1; cycle <= cycles; cycle++) {
    stage = 'before reload'; const before = await snapshot('before reload'); healthy(before); await checkpoint();
    stage = 'reload'; await h.page.reload({ waitUntil: 'load', timeout: 30000 });
    stage = 'after reload before startup';
    await h.page.waitForFunction(() => !!window.__capy && !!(document.querySelector('.capyui-carry') || document.querySelector('.capyui-go')));
    await snapshot('after reload before startup'); await checkpoint();
    const after = await startAndSettle();
    const priorTasks = before.game.save?.tasks || [], tasks = after.game.save?.tasks || [];
    assert.ok(priorTasks.every(id => tasks.includes(id)), 'same-context reload preserves earned progress');
    report.completedCycles = cycle; await checkpoint();
    console.log(JSON.stringify({ cycle, performance: after.performance, dom: after.dom,
      renderer: after.game.renderer, hostMemory: after.hostMemory }));
  }
  report.pass = true; report.finishedAt = new Date().toISOString(); stage = 'complete'; await checkpoint();
  console.log(JSON.stringify({ pass: true, completedCycles: report.completedCycles, artifact: name + '.json.png' }));
} catch (error) {
  report.pass = false; report.failure = { cycle, stage, crashed, message: String(error.stack || error), hostMemory: hostMemory() };
  report.failure.performance = await cdpRead('Performance.getMetrics');
  report.failure.dom = await cdpRead('Memory.getDOMCounters');
  try { await checkpoint(); } catch (sinkError) {
    console.error('Reload evidence sink failed:', String(sinkError)); console.error(JSON.stringify(report));
  }
  throw error;
} finally {
  stage = 'closing owned browser'; await h.close();
}
