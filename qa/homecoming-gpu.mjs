// Headful GPU timer-query attribution. GPU milliseconds are diagnostic samples,
// not FPS or GPU-busy evidence. Draw elapsed can include command-feed stalls;
// simulation runs outside the query. CPU and GPU times must not be added.
import assert from 'node:assert/strict';
import { openHarness, CHAPTERS } from './reimagine-harness.mjs';

const chapter = process.argv[2] || 'monaco';
const mode = process.argv[3] || 'auto';
const tag = process.argv[4] || 'v1';
const instrument = process.argv[5] || '';
assert.ok(CHAPTERS.includes(chapter), 'unknown chapter'); assert.match(tag, /^[\w.-]+$/);
assert.ok(['auto', 'pretty', 'fast'].includes(mode), 'mode must be auto, pretty or fast');
assert.ok(!instrument || instrument === 'passes' || instrument === 'shadows', 'optional mode must be passes or shadows');
const pf = { auto: 0, pretty: 1, fast: 2 }[mode];
const name = `homecoming-gpu-${chapter}-${mode}-${tag}${instrument ? '-' + instrument : ''}`;
const h = await openHarness({ pinRung: false, storage: { 'capy3.prefs.v1': { v: 1, pf } } });
const out = { chapter, mode, tag, instrument, diagnostic: true,
  scope: instrument === 'passes' ? 'renderer.render elapsed by world/mirror/post, excluding simulation; includes command-feed stalls; not FPS or GPU busy time' :
    instrument === 'shadows' ? 'renderer.shadowMap.render elapsed including shadow submission; not FPS or GPU busy time' :
    'post.render elapsed, excluding simulation; includes possible command-feed stalls; not FPS or GPU busy time', metadata: h.metadata, phases: [] };

async function install(byPass) {
  return h.page.evaluate(byPass => {
    const g = window.__capy, gl = g.renderer.getContext();
    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    if (!ext) return { error: 'EXT_disjoint_timer_query_webgl2 unavailable' };
    const pending = [], samples = [], errors = [];
    let rendered = 0, active = true, lost = false, disjoints = 0, activePhase = 'warmup';
    let renderDepth = 0;
    const counts = { world: 0, mirror: 0, post: 0, shadow: 0 };
    const finish = q => {
      if (!gl.getQueryParameter(q.query, gl.QUERY_RESULT_AVAILABLE)) return false;
      samples.push({ ...q.row, gpuMs: gl.getQueryParameter(q.query, gl.QUERY_RESULT) / 1e6 });
      gl.deleteQuery(q.query); return true;
    };
    const poll = () => {
      if (gl.isContextLost()) { lost = true; return; }
      if (gl.getParameter(ext.GPU_DISJOINT_EXT)) {
        disjoints++;
        for (const p of pending) gl.deleteQuery(p.query);
        pending.length = 0; return;
      }
      for (let i = pending.length - 1; i >= 0; i--) if (finish(pending[i])) pending.splice(i, 1);
    };
    const row = () => ({ phase: activePhase, cpuMs: 0, focus: document.hasFocus() && !document.hidden,
      hidden: document.hidden, paused: !!g.state.paused, t: g.state.time,
      rung:g.state.perfRung, lastError:g.state.lastError||null });
    const begin = (kind) => {
      poll();
      if (lost || !active || renderDepth > 0) return null;
      if (++counts[kind] % 4 !== 0 || pending.length >= 12) return null;
      const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); return { query: q, kind, started: performance.now(), row: row() };
    };
    const end = mark => {
      if (!mark) return;
      mark.row.cpuMs = performance.now() - mark.started;
      try { gl.endQuery(ext.TIME_ELAPSED_EXT); }
      catch (e) { if (errors.length < 8) errors.push(String(e && e.stack || e)); }
      pending.push({ query: mark.query, row: { ...mark.row, kind: mark.kind } });
    };
    const passMode = byPass === true || byPass === 'passes', shadowMode = byPass === 'shadows';
    const rawPost = g.post.render, rawRender = g.renderer.render;
    const rawShadow = g.renderer.shadowMap && g.renderer.shadowMap.render;
    const classify = (scene, camera) => scene === g.scene ? (camera === g.camera ? 'world' : 'mirror') : 'post';
    const wrappedPost = function (...args) {
      poll();
      const mark = passMode || shadowMode ? null : begin('post'); rendered++;
      try { return rawPost.apply(this, args); }
      catch (e) { if(errors.length<8)errors.push(String(e && e.stack || e)); throw e; }
      finally { end(mark); }
    };
    const wrappedRender = function (...args) {
      const nested = renderDepth > 0, kind = classify(args[0], args[1]);
      if (!nested) rendered++;
      const mark = nested ? null : begin(kind);
      renderDepth++;
      try { return rawRender.apply(this, args); }
      catch (e) { if(errors.length<8)errors.push(String(e && e.stack || e)); throw e; }
      finally { end(mark); renderDepth--; }
    };
    if (shadowMode && typeof rawShadow !== 'function') return { error: 'renderer.shadowMap.render unavailable' };
    const wrappedShadow = function (...args) {
      // Three calls this for post quads and the mirror too, often with no
      // lights. Attribute only the main world's actual shadow submission.
      if (args[1] !== g.scene || args[2] !== g.camera) return rawShadow.apply(this,args);
      const nested = renderDepth > 0;
      let mark = null;
      if (!nested) { rendered++; mark = begin('shadow'); }
      renderDepth++;
      try { return rawShadow.apply(this, args); }
      catch (e) { if(errors.length<8)errors.push(String(e && e.stack || e)); throw e; }
      finally { end(mark); renderDepth--; }
    };
    if (passMode) g.renderer.render = wrappedRender;
    else if (shadowMode) g.renderer.shadowMap.render = wrappedShadow;
    else g.post.render = wrappedPost;
    window.__homecomingGpu = {
      ext: true, samples, errors, byPass,
      stop() {
        active = false; poll();
        if (passMode) g.renderer.render = rawRender;
        else if (shadowMode) g.renderer.shadowMap.render = rawShadow;
        else g.post.render = rawPost;
        const pendingDropped = pending.length;
        for (const p of pending) { try { gl.deleteQuery(p.query); } catch {} }
        pending.length = 0;
        return { samples, rendered, lost, disjoints, errors, pendingDropped };
      },
      setPhase(label) { activePhase = label; },
    };
    return { ext: true };
  }, instrument || false);
}
async function phase(label, work) {
  await h.page.evaluate(label => window.__homecomingGpu.setPhase(label), label);
  await work();
  out.phases.push({ label }); await h.result(name, out); return out.phases.at(-1);
}
function stats(values) {
  const a = values.filter(Number.isFinite).sort((x, y) => x - y);
  return { n: a.length, p50: a.length ? a[Math.floor(a.length * .5)] : null,
    p95: a.length ? a[Math.floor(a.length * .95)] : null };
}

try {
  await h.start(); await h.arrive(chapter);
  await h.page.waitForFunction(() => !window.__capy.state.renderHold && window.__capy.state.frames > 0);
  await h.page.waitForTimeout(4000);
  const arm = await install(instrument || false); assert.ok(arm.ext, arm.error || 'GPU timer install failed');
  await h.page.waitForFunction(expected => window.__capy.perfAudit().mode === expected, mode);
  await phase('still', () => h.page.waitForTimeout(15000));
  await phase('walk', async () => { await h.hold('w', 5000); await h.hold('d', 5000); await h.hold('s', 5000); });
  await phase('rest', () => h.page.waitForTimeout(15000));
  const stopped = await h.page.evaluate(() => window.__homecomingGpu.stop());
  out.rendered = stopped.rendered; out.lost = stopped.lost; out.disjoints = stopped.disjoints; out.errors = stopped.errors; out.pendingDropped = stopped.pendingDropped;
  for (const row of out.phases) {
    row.samples = stopped.samples.filter(s => s.phase === row.label);
    row.gpu = stats(row.samples.map(s => s.gpuMs)); row.cpu = stats(row.samples.map(s => s.cpuMs));
    row.kinds = {};
    for (const kind of ['world', 'mirror', 'post', 'shadow']) {
      const samples = row.samples.filter(s => s.kind === kind);
      row.kinds[kind] = { gpu: stats(samples.map(s => s.gpuMs)), cpu: stats(samples.map(s => s.cpuMs)) };
    }
    row.focus = row.samples.every(s => s.focus); row.hidden = row.samples.some(s => s.hidden); row.paused = row.samples.some(s => s.paused);
    row.lastError = row.samples.find(s=>s.lastError)?.lastError || null;
  }
  assert.equal(out.lost, false, 'WebGL context lost'); assert.equal(out.disjoints, 0, 'GPU disjoint'); assert.equal(h.metadata.errors.length, 0);
  for (const row of out.phases) {
    assert.ok(row.samples.length >= 30, row.label + ' needs >=30 GPU samples');
    if (instrument === 'shadows') assert.ok(row.kinds.shadow.gpu.n >= 30, row.label + ' needs >=30 shadow samples');
    if (instrument === 'passes') for (const kind of ['world', 'post'])
      assert.ok(row.kinds[kind].gpu.n >= 30, row.label + ' needs >=30 ' + kind + ' samples');
    assert.ok(row.focus && !row.hidden && !row.paused && row.lastError === null, row.label + ' lost live focus');
    assert.ok(row.samples.every(s => s.focus && !s.hidden && !s.paused), row.label + ' sampled an unfocused or paused tick');
    assert.ok(row.samples.every(s => Number.isFinite(s.gpuMs) && s.gpuMs >= 0), row.label + ' invalid GPU sample');
    assert.ok(row.samples.every(s => Number.isFinite(s.cpuMs) && s.cpuMs >= 0), row.label + ' invalid CPU sample');
    assert.equal(out.errors.length, 0, 'instrument errors');
  }
  out.pass = true;
} catch (e) { out.pass = false; out.failure = String(e.stack || e); process.exitCode = 1; }
finally {
  try { await h.page.evaluate(() => window.__homecomingGpu?.stop?.()); } catch {}
  try { await h.result(name, out); } finally { await h.close(); }
  console.log(JSON.stringify({ name, pass: out.pass, phases: out.phases.map(p => ({ label: p.label, n: p.samples?.length||0, gpu: p.gpu })), failure: out.failure || null }));
}
