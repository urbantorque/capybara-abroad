// ROADMAP-HOMECOMING: bounded reload/input stability diagnostic.
// This records resource trends in one owned headful browser; it is not a leak,
// plateau, frame-time, earned-journey, or crash-causality proof.
import assert from 'node:assert/strict';
import { freemem, totalmem } from 'node:os';
import { openHarness } from './reimagine-harness.mjs';

const args = process.argv.slice(2);
const long = args.includes('--long');
const rest = args.filter(arg => arg !== '--long');
const tag = rest[0] || 'v1';
assert.ok(rest.length <= 1, 'usage: node qa/homecoming-stability.mjs [tag] [--long]');
assert.match(tag, /^[\w.-]+$/, 'tag must be a safe artifact suffix');
const name = 'homecoming-stability-' + tag;
const shortCycles = 5, routeMs = 7500;
const chapters = ['sydney', 'hanoi', 'monaco', 'sydney'];
const report = {
  scope: 'One fresh headful story browser and retained normal save. Short mode reloads and restarts five times, then drives trusted W/D/S/A for 30 seconds per cycle. Long mode remains live for 30 minutes and samples the Sydney/Hanoi/Monaco/Sydney arrival fixture every two minutes. No forced GC, task/save/body/input writes, or earned-journey claim.',
  diagnostic: 'Resource trends are observations, not proof of a leak, plateau, or crash cause. Arrival is a public diagnostic fixture, not natural travel.',
  mode: long ? 'long' : 'short', tag, rows: [], events: [], metadata: null,
  capabilities: { performance: false, runtimeHeap: false, performanceMemory: false }
};
const hostMemory = () => ({ freeBytes: freemem(), totalBytes: totalmem() });
let h, cdp, stage = 'setup', cycle = 0, primaryError = null, crashed = false;

async function cdpRead(method) {
  if (!cdp) return { unavailable: 'No page CDP session' };
  try { return await cdp.send(method); }
  catch (error) { return { unavailable: String(error.message || error) }; }
}

async function pageSample(label) {
  const row = { label, cycle, at: new Date().toISOString(), hostMemory: hostMemory(), errors: h.metadata.errors.slice() };
  const perf = await cdpRead('Performance.getMetrics');
  row.cdpPerformance = perf.unavailable ? perf : Object.fromEntries(
    ['JSHeapUsedSize', 'JSHeapTotalSize', 'Documents', 'Nodes'].map(key =>
      [key, perf.metrics?.find(metric => metric.name === key)?.value ?? null]));
  if (!perf.unavailable) report.capabilities.performance = true;
  const heap = await cdpRead('Runtime.getHeapUsage');
  row.cdpHeap = heap.unavailable ? heap : heap;
  if (!heap.unavailable) report.capabilities.runtimeHeap = true;
  row.game = await h.page.evaluate(() => {
    const g = window.__capy, body = g.capy?.body, info = g.renderer?.info;
    const p = body?.position, v = body?.velocity;
    const finite = values => values.every(Number.isFinite);
    let audio = null;
    try {
      const buses = g.hud?.audioBuses?.() || null;
      audio = { music: typeof g.musAudit === 'function' ? g.musAudit() : null,
        sfx: typeof g.sfxAudit === 'function' ? g.sfxAudit() : null,
        buses };
    } catch (error) { audio = { error: String(error.message || error) }; }
    const memory = performance.memory ? {
      usedJSHeapSize: performance.memory.usedJSHeapSize,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
    } : null;
    return {
      started: !!g.state?.started, focused: document.hasFocus(), hidden: document.hidden,
      paused: !!g.state?.paused, chapter: g.biome?.current || null, time: g.state?.time ?? null,
      lastError: g.state?.lastError || null,
      body: { position: p?.toArray?.() || null, velocity: v?.toArray?.() || null,
        finite: !!p && !!v && finite(p.toArray()) && finite(v.toArray()) },
      renderer: { memory: info ? { ...info.memory } : null, programs: info?.programs?.length ?? null,
        calls: info?.render?.calls ?? null, triangles: info?.render?.triangles ?? null },
      props: Array.isArray(g.props) ? g.props.length : null,
      physicsProps: Array.isArray(g.physics?.props) ? g.physics.props.length : null,
      bodies: g.world?.bodies?.length ?? g.physics?.world?.bodies?.length ?? null,
      audio, performanceMemory: memory
    };
  });
  if (row.game.performanceMemory) report.capabilities.performanceMemory = true;
  report.rows.push(row);
  return row;
}

function healthy(row) {
  const g = row.game;
  assert.equal(crashed, false, 'owned page has not crashed');
  assert.equal(g.started, true, 'actual game started');
  assert.equal(g.focused && !g.hidden, true, 'page remains focused and visible');
  assert.equal(g.paused, false, 'actual game unpaused');
  assert.ok(g.body.finite, 'finite capy body');
  assert.equal(g.lastError, null, 'game has no lastError');
  assert.equal(h.metadata.errors.length, 0, 'zero harness runtime errors');
}

async function checkpoint() {
  try { await h.result(name, report); }
  catch (error) { if (!primaryError) primaryError = error; report.events.push({ kind: 'result-sink', message: String(error.message || error) }); }
}

async function waitReady() {
  await h.page.waitForFunction(() => !!window.__capy && !!(document.querySelector('.capyui-carry') || document.querySelector('.capyui-go')));
}

async function startFixture() {
  stage = 'start'; await h.start();
  stage = 'Sydney arrival fixture'; await h.arrive('sydney');
  await h.page.waitForTimeout(1500);
}

async function shortRun() {
  await waitReady(); await startFixture();
  let row = await pageSample('baseline'); healthy(row); await checkpoint();
  for (cycle = 1; cycle <= shortCycles; cycle++) {
    stage = 'reload'; await h.page.reload({ waitUntil: 'load', timeout: 30000 });
    await waitReady(); await startFixture();
    row = await pageSample('cycle-' + cycle + '-before-route'); healthy(row); await checkpoint();
    stage = 'real W/D/S/A square';
    for (const key of ['w', 'd', 's', 'a']) await h.hold(key, routeMs);
    // Same-place arrival is a no-op; this does not reset the animal's body.
    stage = 'post-route Sydney fixture'; await h.arrive('sydney');
    await h.page.waitForTimeout(1000);
    row = await pageSample('cycle-' + cycle + '-after-route'); healthy(row); await checkpoint();
    console.log(JSON.stringify({ cycle, label: row.label, chapter: row.game.chapter,
      heap: row.cdpHeap.usedSize ?? null, geometries: row.game.renderer.memory?.geometries ?? null,
      programs: row.game.renderer.programs }));
  }
}

async function longRun() {
  await waitReady(); await startFixture();
  let row = await pageSample('baseline'); healthy(row); await checkpoint();
  const deadline = Date.now() + 30 * 60 * 1000;
  let index = 0;
  while (Date.now() < deadline) {
    const chapter = chapters[index++ % chapters.length];
    stage = 'long arrival ' + chapter; await h.arrive(chapter);
    await h.page.waitForTimeout(1000);
    row = await pageSample('long-' + index + '-' + chapter); healthy(row); await checkpoint();
    const stop = Math.min(Date.now() + 109500, deadline);
    let keyIndex=0;
    while(Date.now()<stop){
      await h.hold(['w','d','s','a'][keyIndex++%4],Math.min(1500,stop-Date.now()));
      if(keyIndex%20===0){row=await pageSample('long-'+index+'-moving');healthy(row);await checkpoint();}
    }
  }
}

try {
  h = await openHarness({ story: true, pinRung: false });
  report.metadata = h.metadata;
  h.page.on('crash', () => { crashed = true; report.events.push({ kind: 'crash', cycle, stage, at: new Date().toISOString() }); });
  h.browser.on('disconnected', () => report.events.push({ kind: 'browser disconnected', cycle, stage, at: new Date().toISOString() }));
  cdp = await h.context.newCDPSession(h.page);
  try { await cdp.send('Performance.enable'); } catch (error) { report.events.push({ kind: 'CDP Performance unavailable', message: String(error.message || error) }); }
  try { await cdp.send('Runtime.enable'); } catch (error) { report.events.push({ kind: 'CDP Runtime unavailable', message: String(error.message || error) }); }
  if (long) await longRun(); else await shortRun();
  assert.equal(h.metadata.errors.length, 0, 'zero runtime errors');
  report.pass = true; report.finishedAt = new Date().toISOString(); stage = 'complete'; await checkpoint();
  console.log(JSON.stringify({ pass: true, mode: report.mode, rows: report.rows.length, artifact: name + '.json.png' }));
} catch (error) {
  primaryError = primaryError || error;
  report.pass = false; report.failure = { cycle, stage, crashed, message: String(error.stack || error), hostMemory: hostMemory() };
  try { report.failure.performance = await cdpRead('Performance.getMetrics'); report.failure.heap = await cdpRead('Runtime.getHeapUsage'); } catch {}
  if (h) await checkpoint();
} finally {
  if (h) { try { await h.close(); } catch (error) { if (!primaryError) primaryError = error; } }
}
if (primaryError) { console.error(String(primaryError.stack || primaryError)); process.exitCode = 1; }
