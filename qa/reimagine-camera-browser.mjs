// E2: real keys and clock. Controlled flags are fixtures, not natural play.
// node qa/reimagine-camera-browser.mjs sydney
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openHarness, CHAPTERS } from './reimagine-harness.mjs';

const chapter = process.argv[2] || 'sydney';
assert.ok(CHAPTERS.includes(chapter));
const name = 'reimagine-camera-' + chapter, rows = [];
const h = await openHarness();
try {
  await h.page.evaluate(() => {
    window.__cameraKeys = [];
    for (const type of ['keydown', 'keyup']) document.addEventListener(type, e => {
      window.__cameraKeys.push({ type, code: e.code, trusted: e.isTrusted });
    });
  });
  await h.start(); await h.arrive(chapter);
  // End the authored arrival shot through manual control before measuring
  // ordinary exploration. Otherwise the first five seconds test that shot.
  await h.hold('z', 350); await h.page.waitForTimeout(1800);
  const sample = async label => {
    const row = await h.page.evaluate(label => {
      const g = window.__capy, p = g.capy.position, c = g.camera.position;
      return { label, wall: performance.now(), t: g.state.time, hidden: document.hidden,
        paused: g.state.paused, rung: g.state.perfRung, camera: { ...g.camInfo },
        yaw: Math.atan2(c.x - p.x, c.z - p.z), pos: [p.x, p.y, p.z],
        photo: g.hud.photoAudit(), calm: g.hud.calmOn(), far: g.farGlanceAudit() };
    }, label);
    rows.push(row); return row;
  };
  await h.hold('w', 650);
  await sample('stop');
  for (const [label, ms] of [['half-second', 500], ['two-seconds', 1500], ['five-seconds', 3000], ['long-rest', 4000]]) {
    await h.page.waitForTimeout(ms);
    // Quay pedestrians can shove the resting animal. That legitimately resets
    // stillness; wait for six actual undisturbed seconds, not nine on a stopwatch.
    if (label === 'long-rest') await h.page.waitForFunction(
      () => window.__capy.camInfo.still >= 6, null, { timeout: 40000 });
    await sample(label);
    if (label === 'two-seconds' || label === 'long-rest') await h.screenshot(name + '-' + label);
  }
  for (const label of ['half-second', 'two-seconds', 'five-seconds']) {
    const row = rows.find(r => r.label === label);
    assert.ok(row.camera.still < 6, label + ': no deliberate-rest permission yet');
    assert.ok(row.camera.rest < .05, label + ': crane stays down');
  }
  assert.ok(rows.at(-1).camera.still >= 6, 'long rest earns camera permission');
  const short = rows.filter(r => ['half-second', 'two-seconds', 'five-seconds'].includes(r.label));
  assert.ok(short.every(r => r.camera.shot < .002), 'short-stop test is not inside an authored shot');
  if (short.every(r => r.camera.clear > .8 && !r.camera.orbit)) {
    const delta = Math.atan2(Math.sin(short.at(-1).yaw - short[0].yaw), Math.cos(short.at(-1).yaw - short[0].yaw));
    assert.ok(Math.abs(delta) < .08, 'unobstructed short stop preserves bearing');
  }
  await h.page.keyboard.down('e');
  await h.page.waitForTimeout(500);
  const action = await sample('action-held');
  await h.page.keyboard.up('e');
  assert.equal(action.camera.still, 0, 'interaction resets deliberate stillness');
  await h.hold('z', 450);
  const hand = await sample('manual-orbit');
  assert.equal(hand.camera.still, 0, 'manual orbit owns the camera');
  assert.ok(hand.camera.hand > 0, 'trusted Z reached camera');
  await h.page.keyboard.press('c');
  await h.page.waitForTimeout(100);
  assert.ok((await sample('manual-snap')).camera.still < .2, 'snap starts a fresh bank');
  await h.page.keyboard.press('k');
  await h.page.waitForTimeout(500);
  const photo = await sample('photo');
  assert.equal(photo.photo.on, true, 'photo owns its rig');
  assert.equal(photo.camera.still, 0, 'photo does not bank a future camera turn');
  await h.page.keyboard.press('k');
  await h.page.emulateMedia({ reducedMotion: 'reduce' });
  await h.page.waitForTimeout(8500);
  const calm = await sample('reduced-motion');
  assert.equal(calm.calm, true, 'system reduced-motion preference applied');
  assert.ok(calm.camera.rest < .05, 'reduced motion keeps rest crane down');
  await h.page.emulateMedia({ reducedMotion: 'no-preference' });
  for (const mode of ['legacy', 'rung1', 'restored']) {
    await h.page.evaluate(mode => {
      const s = window.__capy.state;
      s.noRestRestraint = mode === 'legacy'; s.perfRung = mode === 'rung1' ? 1 : 0;
    }, mode);
    await h.hold('w', 300); await h.page.waitForTimeout(2300);
    const row = await sample(mode);
    if (mode !== 'restored') assert.equal(row.camera.still, 0, mode + ': inherited bank path');
    else assert.ok(row.camera.still < 6 && row.camera.rest < .05, 'restored short-stop restraint');
  }
  const trusted = await h.page.evaluate(() => window.__cameraKeys);
  assert.ok(trusted.length > 10 && trusted.every(e => e.trusted), 'all input trusted');
  assert.ok(rows.every(r => !r.hidden && !r.paused), 'real visible unpaused clock');
  assert.deepEqual(h.metadata.errors, []);
  const helper = readFileSync('src/systems.js', 'utf8').match(/function sysRestReady\([\s\S]*?\n  \}/)[0];
  const cost = await h.page.evaluate(helper => {
    const result = {};
    for (const mode of ['flag', 'rung']) {
      let reads = 0;
      const state = { get noRestRestraint() { reads++; return mode === 'flag'; },
        get perfRung() { reads++; return 1; } };
      const gate = new Function('game', 'let restStillT=0;' + helper + ';return sysRestReady;')({ state });
      const times = []; let passed = 0;
      for (let b = 0; b < 101; b++) {
        const at = performance.now();
        for (let i = 0; i < 20000; i++) passed += gate(1 / 60, true, false) ? 1 : 0;
        if (b) times.push((performance.now() - at) / 20000);
      }
      times.sort((a,b) => a-b);
      result[mode] = { medianMs: times[50], p95Ms: times[95], reads, passed };
    }
    return result;
  }, helper);
  assert.ok(Object.values(cost).every(r => r.p95Ms < .1), 'cut-gate CPU budget');
  await h.result(name, { metadata: h.metadata, rows, trusted, cost,
    costScope: 'Extracted shipped gate with counted state getters; excludes inherited update and GPU execution.',
    scope: 'Arrival-area movement, short/long stops, held action, manual orbit/snap, photo, reduced motion and fallback; not a full route or vehicle playtest.' });
  console.log(JSON.stringify({ chapter, rows: rows.map(r => ({ label: r.label,
    time: r.t, still: r.camera.still, rest: r.camera.rest, yaw: r.yaw,
    clear: r.camera.clear, shot: r.camera.shot })), cost, errors: h.metadata.errors }, null, 2));
} catch (error) {
  await h.screenshot(name + '-failure');
  await h.result(name + '-failure', { rows, errors: h.metadata.errors, failure: String(error.stack || error) });
  throw error;
} finally { await h.close(); }
