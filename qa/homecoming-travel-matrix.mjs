// M1h: two ordinary full-route laps. Arrival waits and live parking samples
// are reported separately; this is not a long-soak or resource-stability claim.
// arrivalWallMs includes the harness's fixed 9.5s dwell, not measured load time.
// Short timing samples are diagnostic; focus is checked before the sample.
import assert from 'node:assert/strict';
import { openHarness, measureTicks, CHAPTERS } from './reimagine-harness.mjs';

const tag = process.argv[2], oneLap = process.argv.includes('--one-lap');
assert(tag && /^[\w-]+$/.test(tag), 'usage: node qa/homecoming-travel-matrix.mjs <tag>');
const name = 'homecoming-travel-matrix-' + tag;
const h = await openHarness({ pinRung: false });
const out = { metadata: h.metadata, tag, oneLap, baseline: null, arrivals: [] };

async function sample(chapter, lap, step, arrivalWallMs) {
  await h.hold('KeyW', 350);
  await h.hold('KeyS', 350);
  const row = await h.page.evaluate(({ chapter, lap, step, arrivalWallMs, errors, chapters }) => {
    const g = window.__capy;
    const p = g.capy && g.capy.body && g.capy.body.position;
    const roots = g.biome.objectsOf(chapter) || [];
    const sleepingSceneRoots = chapters.filter(name => name !== chapter).reduce((sum, name) =>
      sum + (g.biome.objectsOf(name) || []).filter(root => root.parent === g.scene).length, 0);
    const attachedRoots = roots.filter(root => root.parent === g.scene).length;
    const finitePosition = !!p && [p.x, p.y, p.z].every(Number.isFinite);
    return {
      lap, step, chapter, current: g.biome.current, arrivalWallMs,
      focused: document.hasFocus() && !document.hidden, hidden: document.hidden,
      paused: !!g.state.paused, lastError: g.state.lastError || null,
      finitePosition, position: p ? [p.x, p.y, p.z] : null,
      renderer: {
        geometries: g.renderer.info.memory.geometries,
        textures: g.renderer.info.memory.textures,
        programs: g.renderer.info.programs.length,
      }, bodies: g.world.bodies.length, props: (g.props || []).length,
      attachedRoots, sleepingSceneRoots, runtimeErrors: errors,
    };
  }, { chapter, lap, step, arrivalWallMs, errors: h.metadata.errors.length, chapters: CHAPTERS });
  row.timing = await measureTicks(h.page, 2000);
  assert.equal(row.current, chapter, `arrival chapter mismatch at lap ${lap} step ${step}`);
  assert(row.focused && !row.hidden && !row.paused, `focus/visibility lost at ${chapter}`);
  assert.equal(row.runtimeErrors, 0, `runtime error at ${chapter}`);
  assert.equal(row.lastError, null, `game lastError at ${chapter}`);
  assert(row.finitePosition, `non-finite body position at ${chapter}`);
  assert(row.attachedRoots > 0, `no attached live roots at ${chapter}`);
  assert.equal(row.sleepingSceneRoots, 0, `sleeping scene root attached at ${chapter}`);
  return row;
}

try {
  await h.start();
  await h.page.waitForFunction(() => !window.__capy.state.renderHold && window.__capy.state.frames > 0);
  out.baseline = await h.page.evaluate(() => {
    const g = window.__capy;
    return {
      chapter: g.biome.current, focused: document.hasFocus() && !document.hidden,
      hidden: document.hidden, paused: !!g.state.paused, lastError: g.state.lastError || null,
      bodies: g.world.bodies.length, props: (g.props || []).length,
      renderer: { geometries: g.renderer.info.memory.geometries,
        textures: g.renderer.info.memory.textures, programs: g.renderer.info.programs.length },
    };
  });
  assert.equal(out.baseline.chapter, 'sydney');
  assert(out.baseline.focused && !out.baseline.hidden && !out.baseline.paused);
  assert.equal(out.baseline.lastError, null);

  let step = 0;
  for (let lap = 1; lap <= (oneLap ? 1 : 2); lap++) {
    for (const chapter of [...CHAPTERS.slice(1), 'sydney']) {
      step++;
      const started = performance.now();
      await h.page.bringToFront();
      await h.arrive(chapter);
      const arrivalWallMs = +(performance.now() - started).toFixed(1);
      const row = await sample(chapter, lap, step, arrivalWallMs);
      out.arrivals.push(row);
      // Keep completed arrivals if the owned browser crashes on a later leg.
      await h.result(name, out);
      console.log(JSON.stringify({ lap, step, chapter, arrivalWallMs,
        tickP95: row.timing.tickMs.p95, bodies: row.bodies, props: row.props,
        geometries: row.renderer.geometries, programs: row.renderer.programs }));
    }
  }
  assert.equal(out.arrivals.length, oneLap ? 19 : 38);
  assert.equal(h.metadata.errors.length, 0);
  out.pass = true;
} catch (error) {
  out.pass = false;
  out.failure = String(error.stack || error);
  process.exitCode = 1;
  console.error(out.failure);
} finally {
  try { await h.result(name, out); }
  finally { await h.close(); }
  console.log(JSON.stringify({ name, pass: out.pass, arrivals: out.arrivals.length, failure: out.failure || null }));
}
