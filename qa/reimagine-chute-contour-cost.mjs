// E7: actual extracted stable switch CPU only. No GPU or full-frame claim.
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';

const h = await openHarness();
try {
  await h.start();
  const report = await h.page.evaluate(async () => {
    const g = window.__capy, T = await import('three');
    const source = await (await fetch('/src/kyoto.js')).text();
    const tick = source.match(/function kyoUpdateChute\([^]*?\n\}/)?.[0];
    if (!tick) throw new Error('Actual chute contour writer unavailable');
    const raw = g.tick;
    g.tick = () => {};
    const stats = values => {
      const sorted = values.slice().sort((a, b) => a - b), n = sorted.length;
      return { n, mean: sorted.reduce((a, b) => a + b, 0) / n,
        median: sorted[n >> 1], p95: sorted[Math.min(n - 1, Math.floor(n * .95))] };
    };
    try {
      const callsPerBatch = 10000, batches = 100, fixtures = [];
      for (const mode of ['live', 'flag', 'rung']) {
        let flagReads = 0, rungReads = 0, attributeReads = 0;
        const game = { state: {
          get noChuteContour() { flagReads++; return mode === 'flag'; },
          get perfRung() { rungReads++; return mode === 'rung' ? 1 : 0; }
        } };
        // The stable branch returns before touching these synthetic buffers.
        // Real BufferAttributes also let the untimed initial edge be verified.
        const range = { start: 3612, count: 177 };
        const attributes = Object.fromEntries(['position', 'normal'].map(key =>
          [key, new T.BufferAttribute(new Float32Array((range.start + range.count) * 3), 3)]));
        const base = { position: new Float32Array(531), normal: new Float32Array(531) };
        const live = { position: new Float32Array(531).fill(1), normal: new Float32Array(531).fill(1) };
        const mesh = { geometry: { get attributes() { attributeReads++; return attributes; } } };
        const fixture = new Function('kyoChuteMesh', 'kyoChuteRange', 'kyoChuteBase', 'kyoChuteLive',
          `let kyoChuteOn=false;${tick};return {step:kyoUpdateChute,on:()=>kyoChuteOn};`)(mesh, range, base, live);
        for (let i = 0; i < callsPerBatch; i++) fixture.step(game);
        flagReads = 0; rungReads = 0; attributeReads = 0;
        const versions = [attributes.position.version, attributes.normal.version];
        fixtures.push({ mode, times: [], step: () => fixture.step(game), result: () => ({
          mode, flagReads, rungReads, attributeReads, timedCalls: callsPerBatch * batches,
          on: fixture.on(), versionDeltas: [attributes.position.version - versions[0],
            attributes.normal.version - versions[1]],
          exact: ['position', 'normal'].every(key => attributes[key].array.slice(range.start * 3)
            .every((v, i) => v === (mode === 'live' ? live : base)[key][i]))
        }) });
      }
      // Rotate mode order between batches to reduce a fixed warm/late bias.
      for (let batch = 0; batch < batches; batch++) for (let j = 0; j < fixtures.length; j++) {
        const f = fixtures[(batch + j) % fixtures.length], at = performance.now();
        for (let i = 0; i < callsPerBatch; i++) f.step();
        f.times.push((performance.now() - at) / callsPerBatch);
      }
      return {
        scope: 'Actual extracted kyoUpdateChute stable cut/live/rung path in a visible hardware browser. Includes counted getter and wrapper overhead. Synthetic buffers; initial transition and warmup excluded. Excludes cache construction, flag-edge uploads, rendering, GPU and full-game frame cost.',
        distribution: 'Each observation is a 10,000-call batch mean in milliseconds per call; p95 is across batch means, not individual-frame latency.',
        callsPerBatch, batches, rows: fixtures.map(f => ({ ...f.result(), ms: stats(f.times) })),
        hidden: document.hidden, paused: g.state.paused
      };
    } finally { g.tick = raw; }
  });
  await h.result('reimagine-chute-contour-cost', { metadata: h.metadata, ...report });
  console.log(JSON.stringify(report, null, 2));
  assert.ok(!report.hidden && !report.paused, 'visible active hardware-browser fixture');
  assert.doesNotMatch(h.metadata.renderer.renderer, /swiftshader|llvmpipe|software rasterizer/i,
    'hardware renderer required; CPU scope still excludes rendering');
  for (const row of report.rows) {
    assert.equal(row.flagReads, row.timedCalls, 'observable actual flag reads');
    assert.equal(row.rungReads, row.mode === 'flag' ? 0 : row.timedCalls, 'actual short-circuit rung reads');
    assert.equal(row.attributeReads, 0, 'stable writer never visits mesh attributes');
    assert.deepEqual(row.versionDeltas, [0, 0], 'stable writer never uploads');
    assert.equal(row.on, row.mode === 'live', 'correct cached mode');
    assert.ok(row.exact, 'correct untouched cached profile');
    if (row.mode !== 'live') assert.ok(row.ms.p95 <= .1, 'stable cut CPU batch-p95 budget');
  }
  assert.deepEqual(h.metadata.errors, [], 'zero runtime errors');
} catch (error) {
  await h.result('reimagine-chute-contour-cost-failure', {
    metadata: h.metadata, failure: String(error.stack || error)
  });
  throw error;
} finally { await h.close(); }
