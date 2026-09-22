// Fixed-camera render attribution, not live-play frame-rate certification.
// Simulation is paused; A/B/B/A order exposes warm-up and order effects.
import assert from 'node:assert/strict';
import { openHarness, CHAPTERS } from './reimagine-harness.mjs';
const chapter = process.argv[2] || 'hanoi';
const cut = process.argv[3] || 'shadows';
assert(CHAPTERS.includes(chapter)); assert(['shadows', 'reflection', 'msaa2', 'msaa0'].includes(cut));
const h = await openHarness();
const out = { chapter, cut, metadata: h.metadata, arms: [] };
try {
  await h.start(); await h.arrive(chapter); await h.page.waitForTimeout(4000);
  await h.page.evaluate(() => {
    const g = window.__capy;
    g.__renderAB = { raw: g.tick, paused: g.state.paused,
      pos: g.camera.position.clone(), quat: g.camera.quaternion.clone(),
      fov: g.camera.fov, shadow: g.renderer.shadowMap.enabled, reflect: g.state.noReflect,
      samples: g.post.warmTarget().samples };
    g.state.paused = true;
    g.tick = function (dt) { return g.__renderAB.raw.call(g, dt, false); };
  });
  for (const disabled of [false, true, true, false]) {
    await h.page.bringToFront();
    const arm = await h.page.evaluate(async ({ disabled, cut }) => {
      const g = window.__capy, b = g.__renderAB;
      if (cut === 'shadows') g.renderer.shadowMap.enabled = !disabled;
      else if (cut === 'reflection') g.state.noReflect = disabled;
      else {
        const rt = g.post.warmTarget(), samples = disabled ? (cut === 'msaa2' ? 2 : 0) : b.samples;
        if (rt.samples !== samples) { rt.samples = samples; rt.dispose(); }
      }
      const cpu = [], intervals = [], calls = [];
      let badFocus = 0, last = 0, first = 0;
      await new Promise(resolve => {
        function frame(now) {
          if (!first) first = now;
          g.camera.position.copy(b.pos); g.camera.quaternion.copy(b.quat);
          g.camera.fov = b.fov; g.camera.updateProjectionMatrix(); g.camera.updateMatrixWorld(true);
          g.renderer.info.reset();
          const start = performance.now();
          g.reflectDraw(); g.post.render();
          const elapsed = performance.now() - start;
          if (now - first >= 3000) {
            cpu.push(elapsed); intervals.push(now - last); calls.push(g.renderer.info.render.calls);
            if (document.hidden || !document.hasFocus()) badFocus++;
          }
          last = now;
          if (now - first < 13000) requestAnimationFrame(frame); else resolve();
        }
        requestAnimationFrame(frame);
      });
      const pct = (values, fraction) => {
        values.sort((a, b) => a - b); return +values[Math.floor(values.length * fraction)].toFixed(2);
      };
      return { disabled, frames: cpu.length, cpuP50: pct(cpu, .5), cpuP95: pct(cpu, .95),
        frameP95: pct(intervals, .95), callsP50: pct(calls, .5), badFocus,
        rung: g.state.perfRung, reflection: g.reflectInfo() };
    }, { disabled, cut });
    out.arms.push(arm); console.log(JSON.stringify(arm));
    assert(arm.frames > 100 && arm.badFocus === 0 && arm.rung === 0, 'valid fixed-quality sample');
  }
  assert.equal(h.metadata.errors.length, 0); out.pass = true;
} catch (e) { out.pass = false; out.failure = String(e.stack || e); process.exitCode = 1; }
finally {
  try {
    await h.page.evaluate(() => {
      const g = window.__capy, b = g.__renderAB;
      if (!b) return;
      g.tick = b.raw; g.state.paused = b.paused;
      g.state.noReflect = b.reflect; g.renderer.shadowMap.enabled = b.shadow;
      const rt = g.post.warmTarget();
      if (rt.samples !== b.samples) { rt.samples = b.samples; rt.dispose(); }
      g.renderer.shadowMap.needsUpdate = true; delete g.__renderAB;
    }).catch(() => {});
    await h.result('homecoming-render-' + chapter + '-' + cut, out);
  } finally { await h.close(); }
  console.log(JSON.stringify({ pass: out.pass, failure: out.failure }));
}
