// ROADMAP-REIMAGINE E1: compare actual grass update code with the inherited
// baseline, including every recenter slice. Browser CPU only; no GPU claim.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { openHarness } from './reimagine-harness.mjs';

const ref = '2fd9afaf69f2cdfd585e6c7b1439bd9211335346';
const baseline = execFileSync('git', ['show', ref + ':src/grass.js'], { encoding: 'utf8' });
const h = await openHarness();
try {
  await h.start();
  await h.page.waitForTimeout(6000);
  const result = await h.page.evaluate(async ({ baseline, ref }) => {
    const g = window.__capy, rawTick = g.tick;
    g.tick = () => {};
    const THREE = g.THREE;
    const src = baseline.replace("'./shared.js'", JSON.stringify(new URL('/src/shared.js', location.href).href));
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    const objects = [];
    try {
      const old = await import(url), current = await import('/src/grass.js');
      // Each factory gets its own animal, layout, uniforms and counters. World
      // geometry stays frozen and shared; neither mock subscribes to live events.
      const make = factory => {
        const game = { ...g, state: { ...g.state, noGrass: false, noLawnComposition: true, perfRung: 0 },
          capy: { position: new THREE.Vector3(0, 0.6, 22), velocity: new THREE.Vector3(), grounded: true },
          events: { on() {} } };
        const grass = factory(game);
        objects.push(grass.mesh);
        return { game, grass };
      };
      const a = make(old.createGrass), b = make(current.createGrass);
      g.scene.updateMatrixWorld(true);
      const path = [[-8,14],[-4,14],[0,14],[4,14],[8,14],[8,18],[8,22],[4,22],[0,22],[-4,22],[-8,22],[-8,18]];
      const advance = (subject, i) => {
        const p = path[i % path.length];
        subject.game.capy.position.set(p[0], 0.6, p[1]);
        for (let slice = 0; slice < 4; slice++) subject.grass.update(0);
      };
      // Initial scene scans and allocation are excluded from update timings.
      for (let i = 0; i < 96; i++) { advance(a, i); advance(b, i); }
      const stats = values => {
        const sorted = values.slice().sort((x, y) => x - y);
        return { n: values.length, mean: values.reduce((s,v) => s+v,0)/values.length,
          median: sorted[Math.floor(sorted.length*.5)], p95: sorted[Math.floor(sorted.length*.95)] };
      };
      const times = { baseline: [], currentCut: [] }, pairs = [];
      // Blocks include 24 recenters / 96 placement frames. Averaging the block
      // resolves sub-0.1ms work without timing every callback inside the field.
      const block = subject => {
        const start = performance.now();
        for (let i = 0; i < 24; i++) advance(subject, i);
        return (performance.now() - start) / 96;
      };
      for (let p = 0; p < 24; p++) {
        let av, bv;
        if (p % 2) { bv = block(b); av = block(a); }
        else { av = block(a); bv = block(b); }
        times.baseline.push(av); times.currentCut.push(bv); pairs.push(bv-av);
      }
      // Include a separate per-slice view: the first frame wraps coordinates;
      // all four frames execute their portion of the placement work.
      const sliceTimes = { baseline: [[],[],[],[]], currentCut: [[],[],[],[]] };
      for (let repeat = 0; repeat < 12; repeat++) {
        for (const [key, subject] of repeat % 2 ? [['currentCut', b], ['baseline', a]] : [['baseline', a], ['currentCut', b]]) {
          for (let i = 0; i < path.length; i++) {
            subject.game.capy.position.set(path[i][0], 0.6, path[i][1]);
            for (let slice = 0; slice < 4; slice++) {
              const start = performance.now(); subject.grass.update(0);
              sliceTimes[key][slice].push(performance.now()-start);
            }
          }
        }
      }
      // A stationary update does no layout and should remain near the timer floor.
      const idle = subject => {
        const start = performance.now();
        for (let i=0;i<10000;i++) subject.grass.update(0);
        return (performance.now()-start)/10000;
      };
      const idleMs = { baseline: idle(a), currentCut: idle(b) };
      const cutAudit = b.grass.audit();
      // Recenter while cut must neither evaluate the field nor dirty its GPU
      // attribute. Enabling an invalid cache refills four slices exactly once.
      let fieldCalls = 0;
      const growth = b.game.env.lawnGrowth;
      b.game.env = { ...b.game.env, lawnGrowth(...args) { fieldCalls++; return growth(...args); } };
      const attribute = b.grass.mesh.geometry.getAttribute('aLawnScale');
      const version0 = attribute.version;
      advance(b, 0);
      const lifecycle = { cutCalls: fieldCalls, cutUploads: attribute.version-version0 };
      b.game.state.noLawnComposition = false;
      b.grass.update(0);
      lifecycle.enablingFirstSlice = b.grass.audit();
      for (let i=0;i<3;i++) b.grass.update(0);
      lifecycle.enabled = b.grass.audit();
      const readyCalls = fieldCalls;
      b.game.state.noLawnComposition = true; b.grass.update(0);
      b.game.state.noLawnComposition = false; b.grass.update(0);
      lifecycle.cachedToggleCalls = fieldCalls-readyCalls;
      lifecycle.cachedToggleActive = b.grass.audit().compositionActive;
      b.game.state.perfRung = 1;
      const version1 = attribute.version;
      advance(b, 3);
      lifecycle.parkedCalls = fieldCalls-readyCalls;
      lifecycle.parkedUploads = attribute.version-version1;
      lifecycle.parked = b.grass.audit();
      b.game.state.perfRung = 0;
      for (let i=0;i<4;i++) b.grass.update(0);
      lifecycle.unparked = b.grass.audit();
      const out = { ref, cut: true, baseline: stats(times.baseline), currentCut: stats(times.currentCut),
        addedPlacementFrame: stats(pairs), raw: times,
        slices: Object.fromEntries(Object.entries(sliceTimes).map(([key, arrays]) => [key, arrays.map(stats)])),
        idleMs,
        audits: { baseline: a.grass.audit(), currentCut: cutAudit }, lifecycle,
        note: 'Actual inherited/current grass update, forced recenter every four frames. Includes field math, cache writes and upload dirty marks. Excludes renderer upload/GPU execution; per-slice timers quantized.' };
      return out;
    } finally {
      for (const mesh of objects) { g.scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); }
      URL.revokeObjectURL(url); g.tick = rawTick;
    }
  }, { baseline, ref });
  await h.result('reimagine-lawn-cost', { metadata: h.metadata, ...result });
  console.log(JSON.stringify({ ...result, raw: undefined }, null, 2));
  assert.equal(h.metadata.errors.length, 0, 'no runtime errors');
  assert.equal(result.audits.currentCut.compositionActive, false, 'actual cut path measured');
  assert.equal(result.lifecycle.cutCalls, 0, 'cut recenter skips field math');
  assert.equal(result.lifecycle.cutUploads, 0, 'cut recenter skips composition uploads');
  assert.equal(result.lifecycle.enablingFirstSlice.compositionActive, false, 'first slice keeps old view');
  assert.equal(result.lifecycle.enablingFirstSlice.compositionPending, true, 'first slice reports pending');
  assert.equal(result.lifecycle.enabled.compositionActive, true, 'fourth slice enables composed view');
  assert.equal(result.lifecycle.cachedToggleCalls, 0, 'valid A/B cache does not rebuild');
  assert.equal(result.lifecycle.cachedToggleActive, true, 'cached A/B is immediate');
  assert.equal(result.lifecycle.parkedCalls, 0, 'governor recenter skips field math');
  assert.equal(result.lifecycle.parkedUploads, 0, 'governor recenter skips uploads');
  assert.equal(result.lifecycle.parked.compositionActive, false, 'governor parks view');
  assert.equal(result.lifecycle.unparked.compositionActive, true, 'governor recovery refills view');
  assert.ok(result.addedPlacementFrame.median <= 0.1, 'median additional CPU per placement frame <= 0.1ms');
} finally { await h.close(); }
