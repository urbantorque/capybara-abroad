// Bounded focused crossing trace. Longtasks and tick CPU distinguish a game
// stall from a missed browser frame; neither alone proves GPU causation.
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';

const pretty = process.argv.includes('--pretty');
const cali = process.argv.includes('--cali');
const h = await openHarness({ pinRung: pretty });
const out = { metadata: h.metadata, rows: [],
  scope: `${cali ? 'Five Cali' : 'Four Cave'} arrivals separated by Sydney, headful Edge; rAF gaps, whole-tick CPU and browser longtasks. No GPU timing claim.`,
  profile: pretty ? 'fixed Pretty rung 0' : 'Auto governor' };
try {
  await h.start();
  await h.page.evaluate(() => { window.__qaRoomIds = new WeakMap(); window.__qaRoomNext = 1; });
  const seenRoomIds = new Map();
  const destination = cali ? 'cali' : 'cave';
  const route = process.argv.includes('--short')
    ? [destination, 'sydney', destination]
    : [destination, 'sydney', destination, 'sydney', destination,
        'sydney', destination, ...(cali ? ['sydney', destination] : [])];
  for (const chapter of route) {
    await h.page.bringToFront();
    const row = await h.page.evaluate(async ({ chapter, win }) => {
      const g = window.__capy, fade = document.querySelector('.capyui-fade');
      const began = performance.now(), gaps = [], tickSlow = [], longtasks = [];
      const compileRows = [];
      let last = began, off = -1, offIndex = -1, seenWhite = false;
      let focusLost = 0, hidden = 0, maxTick = 0;
      const programs0 = g.renderer.info.programs.length;
      let programsOff = -1, programKeysOff = null, lightsOff = null;
      const lightCensus = () => {
        const counts = {};
        g.scene.traverseVisible(o => { if (o.isLight) counts[o.type] = (counts[o.type] || 0) + 1; });
        return counts;
      };
      const raw = g.tick;
      const rawCompile = g.renderer.compile;
      g.renderer.compile = function (...args) {
        const t = performance.now(), lights = lightCensus();
        const r = rawCompile.apply(this, args);
        const dust = g.scene.children.find(o => o.isInstancedMesh &&
          o.geometry?.type === 'TetrahedronGeometry' && o.geometry?.parameters?.radius === 0.1);
        const dustPrograms = dust ? g.renderer.properties.get(dust.material).programs : null;
        compileRows.push({ at: t - began, chapter: g.biome.current,
          ms: performance.now() - t, lights, programs: g.renderer.info.programs.length,
          dust: dust ? { id: dust.id, instanced: !!dust.isInstancedMesh,
            count: dust.count, visible: dust.visible,
            programs: dustPrograms?.size || 0,
            pointVariants: dustPrograms ? [...dustPrograms.values()]
              .map(p => p.cacheKey.split(',')[34]) : [] } : null });
        return r;
      };
      let rayWorld = null, rawRay = null, rayMs = 0, rayCalls = 0;
      g.tick = function (...args) {
        if (g.world !== rayWorld) {
          if (rayWorld && rawRay) rayWorld.raycastAll = rawRay;
          rayWorld = g.world; rawRay = rayWorld?.raycastAll || null;
          if (rawRay) rayWorld.raycastAll = function (...rayArgs) {
            const rt = performance.now();
            try { return rawRay.apply(this, rayArgs); }
            finally { rayMs += performance.now() - rt; rayCalls++; }
          };
        }
        rayMs = 0; rayCalls = 0;
        const beforeMs = { ...g.state.perf?.ms }, t = performance.now();
        const grassBefore = g.grass?.audit?.();
        try { return raw.apply(this, args); }
        finally {
          const ms = performance.now() - t;
          maxTick = Math.max(maxTick, ms);
          if (ms > 25 && tickSlow.length < 40) {
            // mainMsAdd uses .035 once per visited module. Invert that filter
            // against its pre-tick value to recover this frame's CPU bill.
            const modules = {};
            for (const [key, value] of Object.entries(g.state.perf?.ms || {})) {
              const old = beforeMs[key];
              if (old === undefined) modules[key] = value;
              else if (value !== old) modules[key] = (value - old * .965) / .035;
            }
            const leaders = Object.entries(modules).sort((a, b) => b[1] - a[1]).slice(0, 8);
            tickSlow.push({ at: t - began, ms, chapter: g.biome.current,
              white: fade?.classList.contains('on') || false,
              hold: !!g.state.renderHold, rung: g.state.perfRung,
              grassBefore, grassAfter: g.grass?.audit?.(),
              rayMs, rayCalls, worldBodies: g.world?.bodies?.length,
              measuredModulesMs: Object.values(modules).reduce((sum, n) => sum + n, 0), leaders });
          }
        }
      };
      let observer = null;
      if (PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
        observer = new PerformanceObserver(list => {
          for (const e of list.getEntries()) if (longtasks.length < 40)
            longtasks.push({ at: e.startTime - began, ms: e.duration, name: e.name });
        });
        observer.observe({ type: 'longtask', buffered: false });
      }
      try {
        const done = new Promise(resolve => {
          const frame = t => {
            gaps.push({ at: t - began, ms: t - last }); last = t;
            if (!document.hasFocus()) focusLost++;
            if (document.hidden) hidden++;
            const white = fade?.classList.contains('on') || false;
            if (white) seenWhite = true;
            else if (seenWhite && off < 0) {
              off = t - began; offIndex = gaps.length;
              programsOff = g.renderer.info.programs.length;
              programKeysOff = new Set(g.renderer.info.programs.map(p => p.cacheKey));
              lightsOff = lightCensus();
            }
            if (t - began < win) requestAnimationFrame(frame); else resolve();
          };
          requestAnimationFrame(frame);
        });
        g.hud.cross(chapter);
        await done;
      } finally {
        g.tick = raw;
        g.renderer.compile = rawCompile;
        if (rayWorld && rawRay) rayWorld.raycastAll = rawRay;
        observer?.disconnect();
      }
      const audio = g.hud.audioBus(), roomNode = audio.roomConv;
      if (roomNode && !window.__qaRoomIds.has(roomNode))
        window.__qaRoomIds.set(roomNode, window.__qaRoomNext++);
      const after = offIndex >= 0 ? gaps.slice(offIndex) : [];
      const late = programKeysOff ? g.renderer.info.programs
        .filter(p => !programKeysOff.has(p.cacheKey)) : [];
      const lateProgramDetails = late.map(p => {
        const tokens = p.cacheKey.split(','); let best = null;
        for (const key of programKeysOff) {
          const v = key.split(',');
          if (v[0] !== tokens[0] || v[v.length - 1] !== tokens[tokens.length - 1]) continue;
          const diff = [];
          for (let i = 0; i < Math.max(v.length, tokens.length); i++)
            if (v[i] !== tokens[i]) diff.push({ index: i, before: v[i], after: tokens[i] });
          if (!best || diff.length < best.length) best = { length: diff.length, diff, prior: key };
        }
        return { id: p.id, key: p.cacheKey, nearest: best };
      });
      const lateIds = new Set(late.map(p => p.id)), lateOwners = [];
      if (lateIds.size) g.scene.traverse(o => {
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        for (const m of mats) {
          const ps = g.renderer.properties.get(m).programs;
          if (!ps?.forEach) continue;
          ps.forEach(p => { if (lateIds.has(p.id) && lateOwners.length < 30)
            lateOwners.push({ program: p.id, object: o.name, objectId: o.id,
              parents: (() => { const a = []; for (let q = o.parent; q && a.length < 5; q = q.parent)
                a.push((q.name || q.type) + '#' + q.id); return a; })(),
              geometry: o.geometry?.type, vertices: o.geometry?.getAttribute('position')?.count,
              material: m.name, color: m.color?.getHexString(), side: m.side,
              visible: o.visible, instanced: !!o.isInstancedMesh, castShadow: o.castShadow }); });
        }
      });
      return { chapter, arrived: g.biome.current === chapter, focused: focusLost === 0,
        visible: hidden === 0, frames: gaps.length, off, maxTick,
        maxGap: Math.max(...gaps.map(x => x.ms)),
        maxAfter: after.length ? Math.max(...after.map(x => x.ms)) : null,
        slowFrames: after.filter(x => x.ms > 50).slice(0, 20),
        over100After: after.filter(x => x.ms > 100).length,
        programsFade: programsOff < 0 ? null : programsOff - programs0,
        programsAfter: programsOff < 0 ? null : g.renderer.info.programs.length - programsOff,
        latePrograms: lateProgramDetails, lateOwners, lightsOff, lightsEnd: lightCensus(),
        tickSlow, longtasks, compileRows, roomNodeId: roomNode ? window.__qaRoomIds.get(roomNode) : null,
        roomSeconds: roomNode?.buffer?.duration || 0, audioState: audio.ac?.state || null,
        rung: g.state.perfRung, error: g.state.lastError || null };
    }, { chapter, win: chapter === destination && out.rows.length === 0 ? 20000 : 6000 });
    out.rows.push(row);
    await h.result('homecoming-cave-hitch', out);
    console.log(JSON.stringify({ chapter, arrived: row.arrived, focused: row.focused,
      frames: row.frames, maxAfter: row.maxAfter, maxTick: row.maxTick,
      longtasks: row.longtasks.length, rung: row.rung }));
    assert.ok(row.arrived && row.focused && row.visible && row.frames >= 150 && !row.error,
      chapter + ' needs a focused, complete crossing');
    assert.ok(row.roomNodeId && row.roomSeconds > 0 && row.audioState === 'running',
      chapter + ' needs an active convolver and audio context');
    if (seenRoomIds.has(chapter)) assert.equal(row.roomNodeId, seenRoomIds.get(chapter),
      chapter + ' must reuse its room convolver on return');
    else seenRoomIds.set(chapter, row.roomNodeId);
    if (pretty && chapter === 'cave' && out.rows.length > 1) assert.ok(
      !row.lateOwners.some(o => o.instanced && o.geometry === 'TetrahedronGeometry' && o.vertices === 12),
      'Cave dust must not compile a reflected shader after white');
  }
  assert.deepEqual(h.metadata.errors, []);
  out.pass = true;
  await h.result('homecoming-cave-hitch', out);
} finally { await h.close(); }
