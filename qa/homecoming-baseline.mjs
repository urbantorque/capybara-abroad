// HOMECOMING M0: real-clock frame pacing and score activity in one place.
import assert from 'node:assert/strict';
import { openHarness, CHAPTERS, snapshot } from './reimagine-harness.mjs';
const chapter = process.argv[2] || 'sydney';
const mode = process.argv[3] || 'auto';
const tag = process.argv[4] || 'before';
const cut = process.argv[5] || 'none';
const phaseSeconds = Number(process.argv[6] || 15);
assert([15, 30].includes(phaseSeconds), '15-second baseline or 90-second route');
assert(CHAPTERS.includes(chapter)); assert(['auto', 'pretty', 'fast'].includes(mode));
assert(/^[\w-]+$/.test(tag));
assert(['none', 'reflection', 'shadows', 'depth'].includes(cut));
const h = await openHarness({ pinRung: false,
  storage: { 'capy3.prefs.v1': { v: 1, pf: ['auto', 'pretty', 'fast'].indexOf(mode) } } });
const out = { chapter, mode, tag, cut, phaseSeconds, metadata: h.metadata, phases: [] };
try {
  await h.start(); await h.arrive(chapter);
  await h.page.waitForFunction(() => !window.__capy.state.renderHold && window.__capy.state.frames > 0);
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
      const data = { frames: [], samples: [], hitches: [], last: performance.now(), lastSample: 0,
        passes: { world: [], mirror: [], post: [], shadow: [] },
        music: g.musAudit(), theme: g.musThemeAudit() };
      g.__homeProbe = { data, raw, rawRender, rawShadow };
      const moduleNames = Object.keys(g.state.perf.ms), beforeMs = new Float64Array(moduleNames.length);
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
        for (let i = 0; i < moduleNames.length; i++) beforeMs[i] = g.state.perf.ms[moduleNames[i]];
        const programsBefore = g.renderer.info.programs.length;
        const start = performance.now();
        const value = raw.apply(this, args);
        const elapsed = performance.now() - start;
        if (args[1] !== false) {
          data.frames.push([start - data.last, elapsed]); data.last = start;
          if (elapsed > 50 && data.hitches.length < 100) {
            // Recover the current sample from mainMsAdd's documented .035
            // EMA. Unchanged modules may have been parked, so omit them.
            const modules = {};
            for (let i = 0; i < moduleNames.length; i++) {
              const name = moduleNames[i], after = g.state.perf.ms[name];
              if (after !== beforeMs[i]) modules[name] = +(beforeMs[i] + (after - beforeMs[i]) / .035).toFixed(2);
            }
            data.hitches.push({ at: start, cpu: elapsed, modules,
              programsBefore, programsAfter: g.renderer.info.programs.length,
              addedPrograms: g.renderer.info.programs.slice(programsBefore).map(p => ({
                type:p.type, name:p.name, cacheKey:p.cacheKey.slice(0,1200) })),
              geometries: g.renderer.info.memory.geometries,
              position: g.capy.body.position.toArray(), contacts: g.world.contacts.length });
            const added = new Set(g.renderer.info.programs.slice(programsBefore));
            if (added.size) {
              const materials = new Map();
              g.scene.traverse(o => {
                for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
                  const programs = g.renderer.properties.get(m).programs;
                  if (programs && [...programs.values()].some(p => added.has(p))) {
                    materials.set(m.uuid, { object: o.name, type: m.type, name: m.name,
                      color: m.color?.getHexString(), transparent: m.transparent,
                      vertexColors: m.vertexColors, flatShading: m.flatShading,
                      depthWrite: m.depthWrite, side: m.side, fog: m.fog,
                      customKey: m.customProgramCacheKey().slice(0, 500) });
                  }
                }
              });
              data.hitches.at(-1).newMaterials = [...materials.values()];
            }
          }
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
      for (const key of ['KeyW', 'KeyD', 'KeyS']) await h.hold(key, phaseSeconds * 1000 / 3);
    } else await h.page.waitForTimeout(phaseSeconds * 1000);
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
      hitches: data.hitches, rung: data.perf.rung, hiddenOrPaused: data.samples.filter(s => s.hidden || s.paused).length,
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
