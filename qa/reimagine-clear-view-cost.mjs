// E5: pinned Quay fixture. GPU timer is the full post frame; paired cut and
// baseline samples show the aggregate delta, not a branch-only budget.
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';

const h = await openHarness();
try {
  await h.start(); await h.arrive('quay');
  const report = await h.page.evaluate(async () => {
    const g = window.__capy, s = await import('/src/shared.js');
    const raw = g.tick; g.tick = () => {};
    const gl = g.renderer.getContext();
    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    const materials = new Set();
    g.scene.traverse(o => {
      for (const m of [o.material, o.customDepthMaterial, o.customDistanceMaterial].flat()) if (m) materials.add(m);
    });
    const originals = [...materials].map(m => ({ m, compile: m.onBeforeCompile,
      key: m.customProgramCacheKey, keyValue: m.customProgramCacheKey() }));
    let activeMode = 'cut';
    let baselineCompiles = 0;
    const camera = g.camera;
    const pin = {
      position: [8.38912856, 3.98141486, 25.94124688],
      quaternion: [-0.11512213, 0.70219636, 0.11667347, 0.69285963],
      fov: 52.0962,
      lensB: [1.26593722, 0.98996741, 26.03659831], r: 0.7
    };
    camera.position.fromArray(pin.position);
    camera.quaternion.fromArray(pin.quaternion);
    camera.fov = pin.fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    const stats = values => {
      const x = values.slice().sort((a, b) => a - b);
      if (!x.length) return { n: 0, mean: null, median: null, p95: null, ci95: null };
      const mean = x.reduce((a, b) => a + b, 0) / x.length;
      const variance = x.length > 1 ? x.reduce((a, b) => a + (b - mean) ** 2, 0) / (x.length - 1) : 0;
      return { n: x.length, mean, median: x[x.length >> 1], p95: x[Math.floor(x.length * .95)],
        ci95: 1.96 * Math.sqrt(variance / x.length) };
    };
    const readFrame = () => {
      const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
      gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let hash = 2166136261, nonzero = 0; const colors = new Set();
      for (let i = 0; i < pixels.length; i += 4) {
        const packed = pixels[i] | (pixels[i + 1] << 8) | (pixels[i + 2] << 16) | (pixels[i + 3] << 24);
        colors.add(packed); if (colors.size > 64) colors.delete(packed);
      }
      for (const value of pixels) { hash = Math.imul(hash ^ value, 16777619) >>> 0; if (value) nonzero++; }
      return { hash, nonzero, colors: colors.size };
    };
    const setMode = mode => {
      activeMode = mode;
      s.lensCapTick(camera.position.x, camera.position.y, camera.position.z,
        ...pin.lensB, pin.r, mode === 'live');
      for (const q of originals) q.m.needsUpdate = true;
    };
    const gpuRender = async () => {
      if (!ext) { const at = performance.now(); g.post.render(); return { cpuMs: performance.now() - at, gpuMs: null, disjoint: false }; }
      const query = gl.createQuery();
      gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
      const at = performance.now(); g.post.render();
      const cpuMs = performance.now() - at;
      gl.endQuery(ext.TIME_ELAPSED_EXT);
      const start = performance.now();
      while (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE) && performance.now() - start < 2000)
        await new Promise(resolve => requestAnimationFrame(resolve));
      const disjoint = !!gl.getParameter(ext.GPU_DISJOINT_EXT);
      const ready = gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE);
      const gpuMs = ready && !disjoint ? gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6 : null;
      gl.deleteQuery(query);
      return { cpuMs, gpuMs, disjoint };
    };
    const warm = async mode => { setMode(mode); g.post.render(); await new Promise(resolve => requestAnimationFrame(resolve)); };
    try {
      for (const q of originals) {
        q.m.onBeforeCompile = function (shader, renderer) {
          q.compile.call(this, shader, renderer);
          if (activeMode === 'baseline') {
            const next = shader.fragmentShader.replace(/float lensCapCut\(float d, float t, float radius\) \{[\s\S]*?\n\}/,
              'float lensCapCut(float d, float t, float radius) {\n return 0.8 * (1.0 - smoothstep(radius - 0.25, radius, d));\n}');
            if (next !== shader.fragmentShader) baselineCompiles++;
            shader.fragmentShader = next;
          }
        };
        q.m.customProgramCacheKey = function () { return q.keyValue + ':E5-cost-' + activeMode; };
      }
      for (const mode of ['cut', 'baseline', 'live']) await warm(mode);
      setMode('baseline'); g.post.render();
      const baselineFrame = readFrame();
      await warm('cut'); g.post.render();
      const cutFrame = readFrame();
      await warm('live'); g.post.render();
      const liveFrame = readFrame();
      const pairs = [], cpuPairs = []; let disjoints = 0;
      for (let i = 0; i < 40; i++) {
        const order = i & 1 ? ['baseline', 'cut'] : ['cut', 'baseline'];
        const row = {};
        for (const mode of order) {
          await warm(mode);
          const sample = await gpuRender();
          row[mode] = sample.gpuMs;
          cpuPairs.push({ mode, ms: sample.cpuMs });
          if (sample.disjoint) disjoints++;
        }
        if (row.cut != null && row.baseline != null) pairs.push({ cut: row.cut, baseline: row.baseline, delta: row.cut - row.baseline });
      }
      const liveGpu = [];
      await warm('live');
      for (let i = 0; i < 8; i++) {
        const sample = await gpuRender();
        if (sample.gpuMs != null) liveGpu.push(sample.gpuMs);
        if (sample.disjoint) disjoints++;
      }
      return {
        gpuTimer: !!ext, fixture: pin, materialCount: originals.length,
        compiledBaselineHelpers: baselineCompiles,
        frames: { baseline: baselineFrame, cut: cutFrame, live: liveFrame },
        pairs: { n: pairs.length, cut: stats(pairs.map(x => x.cut)), baseline: stats(pairs.map(x => x.baseline)),
          delta: stats(pairs.map(x => x.delta)) },
        liveGpu: stats(liveGpu), disjoints,
        cpuWallCall: { cut: stats(cpuPairs.filter(x => x.mode === 'cut').map(x => x.ms)),
          baseline: stats(cpuPairs.filter(x => x.mode === 'baseline').map(x => x.ms)) },
        hidden: document.hidden, paused: g.state.paused,
        scope: 'Pinned real Quay frame, full production post render. Baseline removes only the clear-view helper branch; GPU values are aggregate frame time. CPU values are wall-clock render-call spans and may include driver back-pressure.'
      };
    } finally {
      for (const q of originals) { q.m.onBeforeCompile = q.compile; q.m.customProgramCacheKey = q.key; q.m.needsUpdate = true; }
      g.tick = raw;
    }
  });
  await h.result('reimagine-clear-view-cost', { metadata: h.metadata, ...report });
  console.log(JSON.stringify(report, null, 2));
  assert.ok(!report.hidden && !report.paused);
  assert.ok(report.gpuTimer, 'EXT_disjoint_timer_query_webgl2 required for this cost fixture');
  assert.ok(report.compiledBaselineHelpers > 0, 'baseline must replace the helper in visible production shaders');
  assert.ok(report.frames.baseline.nonzero > 1000 && report.frames.baseline.colors > 4, 'baseline framebuffer is blank or flat');
  assert.notEqual(report.frames.live.hash, report.frames.baseline.hash, 'live clear-view branch did not affect the pinned occluder');
  assert.equal(report.frames.cut.hash, report.frames.baseline.hash, 'cut and inherited baseline render identically');
  assert.ok(report.frames.live.colors > 4, 'live framebuffer lacks pixel diversity');
  assert.ok(report.pairs.n >= 30, 'too many disjoint or unavailable GPU samples');
  assert.deepEqual(h.metadata.errors, []);
} finally { await h.close(); }
