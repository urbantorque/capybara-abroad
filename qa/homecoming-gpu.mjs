// Headful GPU timer-query attribution. GPU milliseconds are diagnostic samples,
// not FPS or GPU-busy evidence. Draw elapsed can include command-feed stalls;
// simulation runs outside the query. CPU and GPU times must not be added.
import assert from 'node:assert/strict';
import { openHarness, CHAPTERS } from './reimagine-harness.mjs';

const chapter = process.argv[2] || 'monaco';
const mode = process.argv[3] || 'auto';
const tag = process.argv[4] || 'v1';
assert.ok(CHAPTERS.includes(chapter), 'unknown chapter'); assert.match(tag, /^[\w.-]+$/);
assert.ok(['auto', 'pretty', 'fast'].includes(mode), 'mode must be auto, pretty or fast');
const pf = { auto: 0, pretty: 1, fast: 2 }[mode];
const name = `homecoming-gpu-${chapter}-${mode}-${tag}`;
const h = await openHarness({ pinRung: false, storage: { 'capy3.prefs.v1': { v: 1, pf } } });
const out = { chapter, mode, tag, diagnostic: true, scope:'post.render elapsed, excluding simulation; includes possible command-feed stalls; not FPS or GPU busy time', metadata: h.metadata, phases: [] };

async function install() {
  return h.page.evaluate(() => {
    const g = window.__capy, gl = g.renderer.getContext();
    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    if (!ext) return { error: 'EXT_disjoint_timer_query_webgl2 unavailable' };
    const raw = g.post.render, pending = [], samples = [], errors = [];
    let rendered = 0, active = true, lost = false, disjoints = 0, activePhase = 'warmup';
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
    g.post.render = function (...args) {
      poll();
      let q = null, at = performance.now();
      if (!lost && active && (++rendered % 4 === 0) && pending.length < 12) {
        q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
      }
      try { return raw.apply(this, args); }
      catch (e) { if(errors.length<8)errors.push(String(e && e.stack || e)); throw e; }
      finally {
        if (q) {
          const cpuMs = performance.now() - at;
          try { gl.endQuery(ext.TIME_ELAPSED_EXT); } catch (e) { errors.push(String(e && e.stack || e)); }
          pending.push({ query: q, row: { phase: activePhase, cpuMs, focus: document.hasFocus() && !document.hidden,
            hidden: document.hidden, paused: !!g.state.paused, t: g.state.time,
            rung:g.state.perfRung, lastError:g.state.lastError||null } });
        }
      }
    };
    window.__homecomingGpu = {
      ext: true, samples, errors,
      stop() {
        active = false; poll(); g.post.render = raw;
        const pendingDropped = pending.length;
        for (const p of pending) { try { gl.deleteQuery(p.query); } catch {} }
        pending.length = 0;
        return { samples, rendered, lost, disjoints, errors, pendingDropped };
      },
      setPhase(label) { activePhase = label; },
    };
    return { ext: true };
  });
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
  const arm = await install(); assert.ok(arm.ext, arm.error || 'GPU timer install failed');
  await h.page.waitForFunction(expected => window.__capy.perfAudit().mode === expected, mode);
  await phase('still', () => h.page.waitForTimeout(15000));
  await phase('walk', async () => { await h.hold('w', 5000); await h.hold('d', 5000); await h.hold('s', 5000); });
  await phase('rest', () => h.page.waitForTimeout(15000));
  const stopped = await h.page.evaluate(() => window.__homecomingGpu.stop());
  out.rendered = stopped.rendered; out.lost = stopped.lost; out.disjoints = stopped.disjoints; out.errors = stopped.errors; out.pendingDropped = stopped.pendingDropped;
  for (const row of out.phases) {
    row.samples = stopped.samples.filter(s => s.phase === row.label);
    row.gpu = stats(row.samples.map(s => s.gpuMs)); row.cpu = stats(row.samples.map(s => s.cpuMs));
    row.focus = row.samples.every(s => s.focus); row.hidden = row.samples.some(s => s.hidden); row.paused = row.samples.some(s => s.paused);
    row.lastError = row.samples.find(s=>s.lastError)?.lastError || null;
  }
  assert.equal(out.lost, false, 'WebGL context lost'); assert.equal(out.disjoints, 0, 'GPU disjoint'); assert.equal(h.metadata.errors.length, 0);
  for (const row of out.phases) {
    assert.ok(row.samples.length >= 30, row.label + ' needs >=30 GPU samples');
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
