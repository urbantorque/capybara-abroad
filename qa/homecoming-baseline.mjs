// HOMECOMING M0: real-clock frame pacing and score activity in one place.
import assert from 'node:assert/strict';
import { openHarness, CHAPTERS, snapshot } from './reimagine-harness.mjs';
const chapter = process.argv[2] || 'sydney';
const mode = process.argv[3] || 'auto';
const tag = process.argv[4] || 'before';
const cut = process.argv[5] || 'none';
assert(CHAPTERS.includes(chapter)); assert(['auto', 'pretty', 'fast'].includes(mode));
assert(/^[\w-]+$/.test(tag));
assert(['none', 'reflection', 'shadows', 'depth'].includes(cut));
const h = await openHarness({ pinRung: false,
  storage: { 'capy3.prefs.v1': { v: 1, pf: ['auto', 'pretty', 'fast'].indexOf(mode) } } });
const out = { chapter, mode, tag, cut, metadata: h.metadata, phases: [] };
try {
  await h.start(); await h.arrive(chapter);
  // Diagnostic cuts only, never production defaults or a new quality tier.
  await h.page.evaluate(cut => {
    const g = window.__capy;
    if (cut === 'reflection') g.state.noReflect = true;
    if (cut === 'shadows') g.renderer.shadowMap.enabled = false;
    if (cut === 'depth') g.state.noDepth = true;
  }, cut);
  await h.page.waitForTimeout(4000);
  out.initial = await snapshot(h.page);
  for (const phase of ['still', 'walk', 'rest']) {
    await h.page.bringToFront();
    await h.page.evaluate(() => {
      const g = window.__capy, raw = g.tick;
      const rawRender = g.renderer.render, rawShadow = g.renderer.shadowMap.render;
      const data = { frames: [], samples: [], last: performance.now(), lastSample: 0,
        passes: { world: [], mirror: [], post: [], shadow: [] },
        music: g.musAudit(), theme: g.musThemeAudit() };
      g.__homeProbe = { data, raw, rawRender, rawShadow };
      g.renderer.render = function (scene, camera) {
        const key = scene === g.scene ? (camera === g.camera ? 'world' : 'mirror') : 'post';
        const start = performance.now();
        try { return rawRender.apply(this, arguments); }
        finally { data.passes[key].push(performance.now() - start); }
      };
      g.renderer.shadowMap.render = function () {
        const start = performance.now();
        try { return rawShadow.apply(this, arguments); }
        finally { data.passes.shadow.push(performance.now() - start); }
      };
      g.tick = function (...args) {
        const start = performance.now();
        const value = raw.apply(this, args);
        if (args[1] !== false) {
          data.frames.push([start - data.last, performance.now() - start]); data.last = start;
          if (start - data.lastSample > 250) {
            const p = g.state.perf;
            data.samples.push({ t: g.state.time, rung: g.state.perfRung, calls: p.calls,
              triangles: p.triangles, contacts: p.contacts, substeps: p.substeps,
              modules: { ...p.ms }, reflection: g.reflectInfo(),
              programs: p.programs, geometries: g.renderer.info.memory.geometries,
              hidden: document.hidden, focused: document.hasFocus(), paused: !!g.state.paused });
            data.lastSample = start;
          }
        }
        return value;
      };
    });
    if (phase === 'walk') {
      await h.hold('KeyW', 5000); await h.hold('KeyD', 5000); await h.hold('KeyS', 5000);
    } else await h.page.waitForTimeout(15000);
    const data = await h.page.evaluate(() => {
      const g = window.__capy, p = g.__homeProbe;
      g.renderer.render = p.rawRender; g.renderer.shadowMap.render = p.rawShadow;
      g.tick = p.raw; delete g.__homeProbe;
      return { ...p.data, musicAfter: g.musAudit(), themeAfter: g.musThemeAudit(),
        state: { lastError: g.state.lastError, started: g.state.started }, perf: g.perfAudit() };
    });
    const intervals = data.frames.slice(1).map(v => v[0]).sort((a, b) => a - b);
    const cpu = data.frames.slice(1).map(v => v[1]).sort((a, b) => a - b);
    const pct = (a, k) => +a[Math.min(a.length - 1, Math.floor(a.length * k))].toFixed(2);
    const summary = { phase, frames: intervals.length, p50: pct(intervals, .5), p95: pct(intervals, .95),
      p99: pct(intervals, .99), cpuP95: pct(cpu, .95), over33: intervals.filter(v => v > 33.4).length,
      over50: intervals.filter(v => v > 50).length, over100: intervals.filter(v => v > 100).length,
      rung: data.perf.rung, hiddenOrPaused: data.samples.filter(s => s.hidden || s.paused).length,
      unfocused: data.samples.filter(s => !s.focused).length };
    summary.passCpu = Object.fromEntries(Object.entries(data.passes).map(([key, values]) => {
      values.sort((a, b) => a - b);
      return [key, { calls: values.length, p95: values.length ? pct(values, .95) : null,
        total: +values.reduce((sum, n) => sum + n, 0).toFixed(2) }];
    }));
    out.phases.push({ summary, ...data });
    console.log(JSON.stringify(summary));
    assert(data.state.started && !data.state.lastError, 'live error-free game');
    assert(summary.hiddenOrPaused === 0, 'uninterrupted visible sample');
    assert(summary.unfocused === 0, 'foreground sample');
  }
  out.pass = h.metadata.errors.length === 0;
  assert(out.pass, 'no browser errors');
} catch (e) { out.failure = String(e.stack || e); out.pass = false; process.exitCode = 1; }
finally {
  try { await h.result('homecoming-' + chapter + '-' + mode + '-' + tag, out); }
  finally { await h.close(); }
  console.log(JSON.stringify({ pass: out.pass, failure: out.failure, errors: h.metadata.errors }));
}
