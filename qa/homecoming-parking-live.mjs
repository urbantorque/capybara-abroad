// Headful travel/return regression, plus same-scene matrix-walk attribution.
import assert from 'node:assert/strict';
import { openHarness, measureTicks, CHAPTERS } from './reimagine-harness.mjs';
const all = process.argv.includes('--all');
const h = await openHarness();
const out = { metadata: h.metadata, visits: [] };
try {
  await h.start();
  for (const chapter of all ? [...CHAPTERS, 'sydney', 'hanoi'] : ['sydney', 'hanoi', 'kyoto', 'venice', 'sydney', 'hanoi']) {
    await h.page.bringToFront(); await h.arrive(chapter);
    await h.hold('w', 350); await h.hold('s', 350);
    const row = await h.page.evaluate(names => {
      const g = window.__capy;
      return { chapter: g.biome.current, rootCounts: Object.fromEntries(names.map(n => [n, g.biome.objectsOf(n)?.length || 0])),
        sleepingSceneRoots: names.filter(n => n !== g.biome.current).reduce((sum, n) =>
          sum + (g.biome.objectsOf(n) || []).filter(o => o.parent === g.scene).length, 0),
        attachedRoots: (g.biome.objectsOf(g.biome.current) || []).filter(o => o.parent === g.scene).length,
        bodies: g.world.bodies.length, reflection: g.reflectInfo(),
        position: g.capy.body.position.toArray(), focused: document.hasFocus() && !document.hidden };
    }, CHAPTERS);
    row.timing = await measureTicks(h.page, 3000);
    assert.equal(row.sleepingSceneRoots, 0); assert(row.attachedRoots > 0 && row.focused);
    assert(row.position.every(Number.isFinite));
    out.visits.push(row); console.log(JSON.stringify(row));
    await h.screenshot('homecoming-parking-' + out.visits.length + '-' + chapter);
  }
  out.matrixABBA = await h.page.evaluate(async () => {
    const THREE = await import('three'), g = window.__capy;
    const roots = ['sydney', 'kyoto', 'venice'].flatMap(n => (g.biome.objectsOf(n) || []).filter(o => !o.parent));
    const original = THREE.Object3D.prototype.updateMatrixWorld;
    let calls = 0;
    THREE.Object3D.prototype.updateMatrixWorld = function (...args) { calls++; return original.apply(this, args); };
    const arms = [];
    try {
      for (const inherited of [true, false, false, true]) {
        for (const o of roots) {
          if (inherited) { THREE.Object3D.prototype.add.call(g.scene, o); o.matrixWorldAutoUpdate = false; }
          else { g.scene.remove(o); o.matrixWorldAutoUpdate = true; }
        }
        const ms = [], counts = [];
        for (let i = 0; i < 120; i++) {
          calls = 0; const t = performance.now(); g.scene.updateMatrixWorld(true);
          ms.push(performance.now() - t); counts.push(calls);
        }
        ms.sort((a, b) => a - b);
        arms.push({ inherited, visited: counts[0], medianMs: ms[60], p95Ms: ms[114] });
      }
    } finally {
      THREE.Object3D.prototype.updateMatrixWorld = original;
      for (const o of roots) { g.scene.remove(o); o.matrixWorldAutoUpdate = true; }
    }
    return arms;
  });
  assert(out.matrixABBA[1].visited < out.matrixABBA[0].visited * .6);
  assert.equal(out.matrixABBA[1].visited, out.matrixABBA[2].visited);
  assert.equal(h.metadata.errors.length, 0); out.pass = true;
  console.log(JSON.stringify(out.matrixABBA));
} catch (e) { out.pass = false; out.failure = String(e.stack || e); process.exitCode = 1; console.error(out.failure); }
finally { await h.result('homecoming-parking-live' + (all ? '-all' : ''), out); await h.close(); }
