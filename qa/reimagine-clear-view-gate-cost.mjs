// E5 gate: isolated WebGL2 helper cost. The production helper is fetched from
// shared.js; this never copies its branch logic into the instrument.
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';

const h = await openHarness();
try {
  await h.start(); await h.arrive('quay');
  const report = await h.page.evaluate(async () => {
    const g = window.__capy, s = await import('/src/shared.js');
    const rawTick = g.tick; g.tick = () => {};
    try {
    const source = await (await fetch('/src/shared.js')).text();
    const helperMatch = source.match(/const _LENS_CAP_CUT = `([\s\S]*?)`;/);
    if (!helperMatch) throw new Error('production _LENS_CAP_CUT was not found');
    const helper = helperMatch[1];
    const canvas = document.createElement('canvas');
    canvas.width = 640; canvas.height = 380;
    const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('isolated WebGL2 context unavailable');
    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    if (!ext) throw new Error('EXT_disjoint_timer_query_webgl2 unavailable');
    const vertexSource = `#version 300 es
      in vec2 aPosition;
      out vec2 vUV;
      void main() { vUV = aPosition * 0.5 + 0.5; gl_Position = vec4(aPosition, 0.0, 1.0); }`;
    const legacy = `float lensCapCut(float d, float t, float radius) {
      return 0.8 * (1.0 - smoothstep(radius - 0.25, radius, d));
    }`;
    const fragmentSource = cut => `#version 300 es
      precision highp float;
      in vec2 vUV;
      uniform float uLensClearView;
      out vec4 outColor;
      ${cut}
      void main() {
        float t = vUV.x;
        float d = abs(vUV.y - 0.5) * 1.4;
        float c = lensCapCut(d, t, 0.7);
        outColor = vec4(c, c * 0.73 + 0.11, 1.0 - c * 0.5, 1.0);
      }`;
    const compile = (type, text) => {
      const shader = gl.createShader(type); gl.shaderSource(shader, text); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    };
    const makeProgram = cut => {
      const p = gl.createProgram(); gl.attachShader(p, compile(gl.VERTEX_SHADER, vertexSource));
      gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fragmentSource(cut))); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      return p;
    };
    const actual = makeProgram(helper), old = makeProgram(legacy);
    const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const configure = (program, clear) => {
      gl.useProgram(program); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      const loc = gl.getAttribLocation(program, 'aPosition'); gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1f(gl.getUniformLocation(program, 'uLensClearView'), clear);
    };
    const drawBatch = (program, clear) => {
      configure(program, clear); gl.viewport(0, 0, canvas.width, canvas.height);
      gl.disable(gl.BLEND); gl.clearColor(0.03, 0.07, 0.13, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      for (let i = 0; i < 16; i++) gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    const checksum = () => {
      const pixels = new Uint8Array(canvas.width * canvas.height * 4);
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let hash = 2166136261, nonzero = 0; const colors = new Set();
      for (let i = 0; i < pixels.length; i += 4) colors.add(pixels[i] | (pixels[i + 1] << 8) | (pixels[i + 2] << 16) | (pixels[i + 3] << 24));
      for (const value of pixels) { hash = Math.imul(hash ^ value, 16777619) >>> 0; if (value) nonzero++; }
      return { hash, nonzero, colors: colors.size };
    };
    const stats = values => {
      const x = values.slice().sort((a, b) => a - b);
      if (!x.length) return { n: 0, mean: null, median: null, p95: null, ci95: null };
      const mean = x.reduce((a, b) => a + b, 0) / x.length;
      const variance = x.length > 1 ? x.reduce((a, b) => a + (b - mean) ** 2, 0) / (x.length - 1) : 0;
      return { n: x.length, mean, median: x[x.length >> 1], p95: x[Math.floor(x.length * .95)],
        ci95: 1.96 * Math.sqrt(variance / x.length) };
    };
    const timed = async (program, clear) => {
      const q = gl.createQuery(); configure(program, clear);
      gl.beginQuery(ext.TIME_ELAPSED_EXT, q); drawBatch(program, clear); gl.endQuery(ext.TIME_ELAPSED_EXT);
      const start = performance.now();
      while (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE) && performance.now() - start < 2000)
        await new Promise(resolve => requestAnimationFrame(resolve));
      const disjoint = !!gl.getParameter(ext.GPU_DISJOINT_EXT);
      const ready = gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE);
      const gpuMs = ready && !disjoint ? gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6 : null;
      gl.deleteQuery(q); return { gpuMs, disjoint };
    };
    const warm = (program, clear) => { drawBatch(program, clear); gl.finish(); };
    const samples = { actualOff: [], legacy: [], actualLive: [] }, pairs = [];
    const disjoints = { actualOff: 0, legacy: 0, actualLive: 0 };
    const capture = (program, clear) => { drawBatch(program, clear); return checksum(); };
    warm(actual, 0); const actualOffFrame = capture(actual, 0);
    warm(old, 0); const legacyFrame = capture(old, 0);
    warm(actual, 1); const actualLiveFrame = capture(actual, 1);
    for (let i = 0; i < 48; i++) {
      const round = {};
      const order = i & 1 ? [['legacy', old, 0], ['actualOff', actual, 0], ['actualLive', actual, 1]]
        : [['actualLive', actual, 1], ['actualOff', actual, 0], ['legacy', old, 0]];
      for (const [name, program, clear] of order) {
        warm(program, clear); const row = await timed(program, clear);
        if (row.gpuMs != null) samples[name].push(row.gpuMs); if (row.disjoint) disjoints[name]++;
        if (row.gpuMs != null) round[name] = row.gpuMs;
      }
      if (round.actualOff != null && round.legacy != null && round.actualLive != null) pairs.push(round);
    }
    const before = s.lensCapInfo(), beforeA = before.a.toArray(), beforeB = before.b.toArray();
    let writerMs = 0, getterMs = 0;
    try {
      const writerStart = performance.now();
      for (let i = 0; i < 20000; i++) s.lensCapTick(1, 2, 3, 4, 5, 6, i & 1 ? 0.7 : 0, i & 1);
      writerMs = performance.now() - writerStart;
      const getterStart = performance.now();
      for (let i = 0; i < 20000; i++) s.lensCapInfo();
      getterMs = performance.now() - getterStart;
    } finally {
      s.lensCapTick(...beforeA, ...beforeB, before.r, before.clearView);
    }
    return {
      context: 'isolated second WebGL2 canvas, 640x380, 16 full-viewport layers per timer query',
      helperExtracted: helper, frames: { actualOff: actualOffFrame, legacy: legacyFrame, actualLive: actualLiveFrame },
      samples: { actualOff: stats(samples.actualOff), legacy: stats(samples.legacy), actualLive: stats(samples.actualLive),
        paired: { n: pairs.length, offMinusLegacy: stats(pairs.map(x => x.actualOff - x.legacy)),
          liveMinusLegacy: stats(pairs.map(x => x.actualLive - x.legacy)) } },
      disjoints, writerBenchmark: { calls: 20000, ms: writerMs, usPerCall: writerMs * 1000 / 20000,
        getterMs, getterUsPerCall: getterMs * 1000 / 20000 },
      nonblank: actualLiveFrame.nonzero > 1000 && actualLiveFrame.colors > 4
    };
    } finally { g.tick = rawTick; }
  });
  await h.result('reimagine-clear-view-gate-cost', { metadata: h.metadata, ...report });
  console.log(JSON.stringify(report, null, 2));
  assert.equal(report.frames.actualOff.hash, report.frames.legacy.hash, 'production helper false-uniform output differs from legacy return');
  assert.notEqual(report.frames.actualLive.hash, report.frames.legacy.hash, 'live branch did not affect isolated pixels');
  assert.ok(report.nonblank, 'isolated live frame is blank or flat');
  assert.ok(report.samples.actualOff.n >= 40 && report.samples.legacy.n >= 40 && report.samples.actualLive.n >= 40, 'insufficient valid GPU samples');
  assert.ok(report.samples.paired.n >= 40, 'insufficient complete paired rounds');
  assert.deepEqual(report.disjoints, { actualOff: 0, legacy: 0, actualLive: 0 }, 'GPU timer disjoint invalidated samples');
  assert.deepEqual(h.metadata.errors, []);
} finally { await h.close(); }
