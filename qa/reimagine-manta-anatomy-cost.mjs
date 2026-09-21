// E9: actual stable switch CPU plus E8/E9 isolated geometry-only GPU comparison.
// No production lighting, grain, shadow, underwater, post or full-frame claim.
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';

const h = await openHarness();
try {
  await h.start(); await h.arrive('palawan');
  const report = await h.page.evaluate(async () => {
    const g = window.__capy, T = await import('three'), shared = await import('/src/shared.js');
    const source = await (await fetch('/src/palawan.js')).text();
    const tick = source.match(/function palMantaContourTick\([^]*?\n\}/)?.[0];
    if (!tick || !g.palawan?.mantaContourAudit) throw new Error('Actual manta writer/audit unavailable');
    const raw = g.tick, old = { flag: g.state.noMantaContour, rung: g.state.perfRung, round: g.state.noRound,
      anatomy: g.state.noMantaAnatomy };
    g.tick = () => {};
    let renderer, canvas;
    const cloned = new Map(), materials = [], isolatedMeshes = [];
    const stats = values => {
      const sorted = values.slice().sort((a, b) => a - b), n = sorted.length;
      if (!n) return { n: 0, mean: null, median: null, p95: null, ci95HalfWidth: null };
      const mean = sorted.reduce((a, b) => a + b, 0) / n;
      const variance = n > 1 ? sorted.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) : 0;
      return { n, mean, median: sorted[n >> 1], p95: sorted[Math.min(n - 1, Math.floor(n * .95))],
        ci95HalfWidth: 1.96 * Math.sqrt(variance / n) };
    };
    try {
      const collect = () => {
        const audit = g.palawan.mantaContourAudit(), map = new Map();
        g.scene.traverse(o => { if (o.userData.mantaContour) map.set(o.uuid, o); });
        if (audit.rows.length !== 6 || !audit.rows.every(r => r.exact)) throw new Error('Six exact manta slots required');
        return { audit, map };
      };
      const mode = (anatomyCut, flag = false, rung = 0, round = false) => {
        g.state.noMantaContour = flag; g.state.perfRung = rung; g.state.noRound = round;
        g.state.noMantaAnatomy = anatomyCut;
        raw(0, false); return collect();
      };
      const before = mode(true), ids = before.audit.rows.map(r => r.uuid);
      const bases = ids.map(id => before.map.get(id).geometry), baseMaterials = ids.map(id => before.map.get(id).material);
      const after = mode(false), lives = ids.map(id => after.map.get(id).geometry);
      const smooth = after.map.get(ids[0]).material;
      if (before.audit.anatomy || !after.audit.anatomy ||
          before.audit.rows.reduce((n, r) => n + r.actualTriangles, 0) !== 1072 ||
          after.audit.rows.reduce((n, r) => n + r.actualTriangles, 0) !== 1248)
        throw new Error('Actual E8/E9 modes and1072/1248 triangles required');
      if (new Set(bases).size !== 3 || new Set(lives).size !== 3 ||
          bases.filter((b, i) => b !== lives[i]).length !== 2)
        throw new Error('Only the two shared body slots should change; four tip slots stay E8');
      if (smooth.flatShading || baseMaterials.some(m => m !== smooth) ||
          ids.some(id => after.map.get(id).material !== smooth))
        throw new Error('E8 and E9 must use the exact same private smooth material');
      const legacy = mode(true, true), originals = ids.map(id => legacy.map.get(id).geometry);
      const originalMaterials = ids.map(id => legacy.map.get(id).material);
      if (legacy.audit.rows.reduce((n, r) => n + r.actualTriangles, 0) !== 1344)
        throw new Error('Original noContour fallback must retain1344 triangles');
      if (originalMaterials.some(m => !m.flatShading || m === smooth))
        throw new Error('Original flat material must remain separate and unchanged');
      const parity = [];
      for (const [label, anatomyCut, flag, rung, round] of [
        ['anatomyCut', true, false, 0, false], ['noContour', false, true, 0, false],
        ['rung', false, false, 1, false], ['noRound', false, false, 0, true]
      ]) {
        const state = mode(anatomyCut, flag, rung, round);
        const expected = label === 'anatomyCut' ? bases : label === 'noRound' ? lives : originals;
        parity.push({ label, exactGeometry: ids.every((id, i) => state.map.get(id).geometry === expected[i]),
          exactMaterial: ids.every((id, i) => state.map.get(id).material ===
            (label === 'anatomyCut' ? smooth : originalMaterials[i])) });
      }
      mode(false); g.scene.updateMatrixWorld(true);
      const transforms = ids.map(id => before.map.get(id).matrixWorld.clone());

      // Dummy slots retain actual cached references; no timed call writes to
      // production meshes. Observable getter counts prevent an elided gate.
      const fixtures = [];
      for (const name of ['anatomyCut', 'live', 'rung', 'noContour']) {
        let reads = 0, writes = 0;
        const game = { state: {
          get noMantaAnatomy() { return name === 'anatomyCut'; },
          get noMantaContour() { reads++; return name === 'noContour'; },
          get perfRung() { return name === 'rung' ? 1 : 0; },
          noRound: false
        } };
        const rows = ids.map((id, i) => {
          let geometry = originals[i], material = originalMaterials[i];
          return { base: originals[i], live: bases[i], anatomy: after.audit.rows[i].anatomyUuid ? lives[i] : null,
            material: originalMaterials[i], mesh: {
            get geometry() { return geometry; }, set geometry(value) { writes++; geometry = value; },
            get material() { return material; }, set material(value) { writes++; material = value; }
          } };
        });
        const step = new Function('palMantaContours', 'palMantaSmoothMat',
          `let palMantaContourOn=false,palMantaSmoothOn=false,palMantaAnatomyOn=false;${tick};return palMantaContourTick;`)(rows, smooth);
        for (let i = 0; i < 10000; i++) step(game);
        reads = 0; writes = 0;
        fixtures.push({ name, times: [], step: () => step(game), result: () => ({ mode: name, reads, writes,
          timedCalls: 1000000, exact: rows.every(r => r.mesh.geometry ===
            (name === 'anatomyCut' ? r.live : name === 'live' ? (r.anatomy || r.live) : r.base) &&
            r.mesh.material === (name === 'live' || name === 'anatomyCut' ? smooth : r.material)) }) });
      }
      for (let batch = 0; batch < 100; batch++) for (let j = 0; j < fixtures.length; j++) {
        const f = fixtures[(batch + j) % fixtures.length], at = performance.now();
        for (let i = 0; i < 10000; i++) f.step();
        f.times.push((performance.now() - at) / 10000);
      }

      // Clone geometry once per shared slot. The secondary renderer sees only
      // its own plain Lambert materials, never production material instances.
      const clone = geometry => {
        if (!cloned.has(geometry)) cloned.set(geometry, geometry.clone());
        return cloned.get(geometry);
      };
      const geometries = { cut: bases.map(clone), live: lives.map(clone) };
      const cutMat = new T.MeshLambertMaterial({ color: shared.PALETTE.sail, vertexColors: true, flatShading: false });
      const liveMat = cutMat; // geometry-only: identical material and shader in both variants
      materials.push(cutMat);
      canvas = document.createElement('canvas');
      Object.assign(canvas.style, { position: 'fixed', left: '0', top: '0', width: '1280px', height: '760px', zIndex: '2147483647' });
      document.body.appendChild(canvas);
      renderer = new T.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1); renderer.setSize(1280, 760, false); renderer.shadowMap.enabled = false;
      const gl = renderer.getContext(), ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
      if (!ext) throw new Error('Hardware GPU timer unavailable; no CPU timing substitute');
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      const identity = { renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        vendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR) };
      const scene = new T.Scene(); scene.background = new T.Color(shared.PALETTE.sail);
      scene.add(new T.AmbientLight(shared.PALETTE.sail, 1.2));
      const light = new T.DirectionalLight(shared.PALETTE.sail, 2); light.position.set(3, 5, 8); scene.add(light);
      const bounds = new T.Box3();
      for (let i = 0; i < ids.length; i++) {
        const mesh = new T.Mesh(geometries.cut[i], cutMat); mesh.matrixAutoUpdate = false;
        mesh.matrix.copy(transforms[i]); mesh.frustumCulled = false; isolatedMeshes.push(mesh); scene.add(mesh);
        for (const geometry of [geometries.cut[i], geometries.live[i]]) {
          geometry.computeBoundingBox(); bounds.union(geometry.boundingBox.clone().applyMatrix4(transforms[i]));
        }
      }
      const target = bounds.getCenter(new T.Vector3()), radius = bounds.getSize(new T.Vector3()).length() / 2;
      const height = radius * 2.3, width = height * 1280 / 760;
      const camera = new T.OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, .1, 1000);
      camera.position.copy(target).add(new T.Vector3(.6, .8, 1).normalize().multiplyScalar(radius * 4)); camera.lookAt(target);
      const draw = (which, n = 1) => {
        isolatedMeshes.forEach((mesh, i) => { mesh.geometry = geometries[which][i]; mesh.material = which === 'cut' ? cutMat : liveMat; });
        for (let i = 0; i < n; i++) renderer.render(scene, camera);
      };
      const checksum = () => {
        const bytes = new Uint8Array(1280 * 760 * 4); gl.readPixels(0, 0, 1280, 760, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
        let hash = 2166136261; const colors = new Set();
        for (let i = 0; i < bytes.length; i++) {
          hash = Math.imul(hash ^ bytes[i], 16777619) >>> 0;
          if (i % 4 === 0) colors.add(bytes[i] | bytes[i + 1] << 8 | bytes[i + 2] << 16);
        }
        return { hash, colors: colors.size };
      };
      const frames = {}, draws = {}, warmup = { variants: ['cut', 'live'], rendersEach: 24, excludedFromTiming: true };
      for (const which of warmup.variants) { draw(which, warmup.rendersEach); gl.finish(); }
      for (const which of ['cut', 'live', 'cutAgain', 'liveAgain']) {
        const mode = which.startsWith('cut') ? 'cut' : 'live';
        draw(mode); frames[which] = checksum(); draws[which] = { ...renderer.info.render };
      }
      const pairs = [], samples = [], batchRenders = 64, deadline = performance.now() + 45000;
      let disjoints = 0, timeouts = 0;
      const timed = async which => {
        if (performance.now() > deadline) throw new Error('GPU measurement exceeded45s');
        const wasDisjoint = !!gl.getParameter(ext.GPU_DISJOINT_EXT), query = gl.createQuery();
        gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
        const at = performance.now(); draw(which, batchRenders); const cpuSubmitMs = performance.now() - at;
        gl.endQuery(ext.TIME_ELAPSED_EXT); gl.flush();
        const start = performance.now();
        while (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE) && performance.now() - start < 1500)
          await new Promise(resolve => requestAnimationFrame(resolve));
        const ready = gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE);
        const disjoint = wasDisjoint || !!gl.getParameter(ext.GPU_DISJOINT_EXT);
        const batchGpuMs = ready && !disjoint ? gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6 : null;
        gl.deleteQuery(query); if (disjoint) disjoints++; if (!ready) timeouts++;
        return { which, batchGpuMs, gpuPerRenderMs: batchGpuMs === null ? null : batchGpuMs / batchRenders,
          cpuSubmitMs, ready, disjoint };
      };
      for (let i = 0; i < 40; i++) {
        const order = i % 2 ? ['live', 'cut'] : ['cut', 'live'], row = {};
        for (const which of order) { row[which] = await timed(which); samples.push({ pair: i, order, ...row[which] }); }
        if (row.cut.gpuPerRenderMs !== null && row.live.gpuPerRenderMs !== null)
          pairs.push({ pair: i, order, cut: row.cut.gpuPerRenderMs, live: row.live.gpuPerRenderMs,
            delta: row.live.gpuPerRenderMs - row.cut.gpuPerRenderMs });
      }
      return {
        cpu: { scope: 'Actual extracted palMantaContourTick stable anatomy-cut/live/rung/noContour paths, dummy mesh slots with actual original/E8/E9 references; counted getter and wrapper overhead included. Initial edge/warmup excluded. No construction, edge upload/compile, GPU or full-frame cost.',
          distribution: '100 rotated-order batches of10,000 calls; p95 is across per-call batch means, not individual-frame latency.',
          rows: fixtures.map(f => ({ ...f.result(), ms: stats(f.times) })) },
        sourceGeometry: { before: before.audit, live: after.audit, original: legacy.audit, fallback: parity,
          sameProductionMaterial: true, changedBodySlots: 2, sharedTipSlots: 4, actualCacheBytes: after.audit.cacheBytes,
          capturedBy: 'Actual game.tick(0,false) anatomy/contour/rung/noRound transitions; six meshes and frozen production world transforms; clones preserve attributes.',
          transforms: transforms.map(m => m.toArray()) },
        gpu: { scope: 'Isolated E8 versus E9: six meshes across two mantas, three actual slots per animal. Same plain smooth Lambert material in both variants, authored vertex colours and frozen transforms; geometry-only comparison. Excludes production grain/material hooks, water, fog, shadows, animation and post; not full-game cost.',
          identity, viewport: [1280, 760], meshes: 6, slotsPerAnimal: 3, uniqueClonedGeometries: cloned.size, sameIsolatedMaterial: cutMat === liveMat, warmup, batchRenders,
          requestedPairs: 40, validPairs: pairs.length, disjoints, timeouts, frames, draws,
          perRenderMs: { cut: stats(pairs.map(p => p.cut)), live: stats(pairs.map(p => p.live)), pairedDelta: stats(pairs.map(p => p.delta)) },
          ciScope: 'Normal-approximation95% confidence half-width for paired mean; repeated GPU samples can be autocorrelated. No independent-population claim.', pairs, samples },
        hidden: document.hidden, paused: g.state.paused
      };
    } finally {
      for (const geometry of cloned.values()) geometry.dispose();
      for (const material of materials) material.dispose();
      renderer?.dispose(); renderer?.forceContextLoss(); canvas?.remove();
      g.state.noMantaContour = old.flag; g.state.perfRung = old.rung; g.state.noRound = old.round;
      g.state.noMantaAnatomy = old.anatomy;
      raw(0, false); g.tick = raw;
    }
  });
  await h.result('reimagine-manta-anatomy-cost', { metadata: h.metadata, ...report });
  console.log(JSON.stringify(report, null, 2));
  assert.ok(!report.hidden && !report.paused, 'visible active hardware browser');
  assert.doesNotMatch(report.gpu.identity.renderer, /swiftshader|llvmpipe|software rasterizer/i, 'hardware GPU required');
  for (const row of report.cpu.rows) {
    assert.equal(row.reads, row.timedCalls, 'observable actual gate execution');
    assert.equal(row.writes, 0, 'zero stable geometry/material writes'); assert.ok(row.exact, 'exact stable references');
    if (row.mode !== 'live') assert.ok(row.ms.p95 <= .1, 'stable cut CPU budget');
  }
  assert.ok(report.sourceGeometry.fallback.every(r => r.exactGeometry && r.exactMaterial), 'exact production fallback references');
  assert.ok(report.gpu.sameIsolatedMaterial && report.sourceGeometry.sameProductionMaterial, 'same material geometry-only comparison');
  assert.equal(report.gpu.uniqueClonedGeometries, 4, 'two unchanged tip caches plus E8/E9 body caches');
  assert.ok(report.gpu.validPairs >= 30, 'sufficient valid GPU pairs');
  assert.equal(report.gpu.draws.cut.calls, 6, 'six actual manta draw slots');
  assert.equal(report.gpu.draws.live.calls, 6, 'no added live draw slots');
  assert.equal(report.gpu.draws.cut.triangles, 1072, 'actual accepted E8 triangle count');
  assert.equal(report.gpu.draws.live.triangles, 1248, 'actual E9 anatomy triangle count');
  assert.ok(report.gpu.frames.cut.colors > 8 && report.gpu.frames.live.colors > 8, 'nonflat visible frames');
  assert.notEqual(report.gpu.frames.cut.hash, report.gpu.frames.live.hash, 'actual anatomy geometry contribution visible');
  assert.deepEqual(report.gpu.frames.cut, report.gpu.frames.cutAgain, 'exact isolated cut restoration');
  assert.deepEqual(report.gpu.frames.live, report.gpu.frames.liveAgain, 'exact isolated live restoration');
  assert.deepEqual(h.metadata.errors, [], 'zero runtime errors');
} catch (error) {
  await h.result('reimagine-manta-anatomy-cost-failure', { metadata: h.metadata, failure: String(error.stack || error) });
  throw error;
} finally { await h.close(); }
