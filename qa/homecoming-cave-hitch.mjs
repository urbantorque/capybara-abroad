// Bounded focused crossing trace. Longtasks and tick CPU distinguish a game
// stall from a missed browser frame; neither alone proves GPU causation.
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';

const h = await openHarness({ pinRung: false });
const out = { metadata: h.metadata, rows: [],
  scope: 'Four Cave arrivals separated by Sydney, headful Edge; rAF gaps, whole-tick CPU and browser longtasks. No GPU timing claim.' };
try {
  await h.start();
  await h.page.evaluate(() => { window.__qaRoomIds = new WeakMap(); window.__qaRoomNext = 1; });
  const seenRoomIds = new Map();
  for (const chapter of ['cave', 'sydney', 'cave', 'sydney', 'cave', 'sydney', 'cave']) {
    await h.page.bringToFront();
    const row = await h.page.evaluate(async ({ chapter, win }) => {
      const g = window.__capy, fade = document.querySelector('.capyui-fade');
      const began = performance.now(), gaps = [], tickSlow = [], longtasks = [];
      let last = began, off = -1, offIndex = -1, seenWhite = false;
      let focusLost = 0, hidden = 0, maxTick = 0;
      const programs0 = g.renderer.info.programs.length;
      let programsOff = -1;
      const raw = g.tick;
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
            }
            if (t - began < win) requestAnimationFrame(frame); else resolve();
          };
          requestAnimationFrame(frame);
        });
        g.hud.cross(chapter);
        await done;
      } finally {
        g.tick = raw;
        if (rayWorld && rawRay) rayWorld.raycastAll = rawRay;
        observer?.disconnect();
      }
      const audio = g.hud.audioBus(), roomNode = audio.roomConv;
      if (roomNode && !window.__qaRoomIds.has(roomNode))
        window.__qaRoomIds.set(roomNode, window.__qaRoomNext++);
      const after = offIndex >= 0 ? gaps.slice(offIndex) : [];
      return { chapter, arrived: g.biome.current === chapter, focused: focusLost === 0,
        visible: hidden === 0, frames: gaps.length, off, maxTick,
        maxGap: Math.max(...gaps.map(x => x.ms)),
        maxAfter: after.length ? Math.max(...after.map(x => x.ms)) : null,
        slowFrames: after.filter(x => x.ms > 50).slice(0, 20),
        over100After: after.filter(x => x.ms > 100).length,
        programsFade: programsOff < 0 ? null : programsOff - programs0,
        programsAfter: programsOff < 0 ? null : g.renderer.info.programs.length - programsOff,
        tickSlow, longtasks, roomNodeId: roomNode ? window.__qaRoomIds.get(roomNode) : null,
        roomSeconds: roomNode?.buffer?.duration || 0, audioState: audio.ac?.state || null,
        rung: g.state.perfRung, error: g.state.lastError || null };
    }, { chapter, win: chapter === 'cave' && out.rows.length === 0 ? 20000 : 6000 });
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
  }
  assert.deepEqual(h.metadata.errors, []);
  out.pass = true;
  await h.result('homecoming-cave-hitch', out);
} finally { await h.close(); }
