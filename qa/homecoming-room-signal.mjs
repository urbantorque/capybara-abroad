// A returning room must carry an effects tail, not merely own a convolver.
// This is a graph-level signal check, not a human listening assessment.
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';

const h = await openHarness({ pinRung: false });
const out = { metadata: h.metadata, rows: [],
  scope: 'Headful Edge live effects-return energy after Cave, Sydney and Cave crossings.' };
try {
  await h.start();
  for (const chapter of ['cave', 'sydney', 'cave']) {
    await h.page.bringToFront();
    await h.page.evaluate(name => window.__capy.hud.cross(name), chapter);
    await h.page.waitForFunction(name => {
      const g = window.__capy, r = g.hud.roomAudit();
      return g.biome.current === name && r.biome === name && g.music.room === name && r.conv &&
        g.hud.audioBus().ac?.state === 'running';
    }, chapter, { timeout: 20000 });
    const row = await h.page.evaluate(async name => {
      const g = window.__capy, b = g.hud.audioBus(), ac = b.ac;
      const proc = ac.createScriptProcessor(1024, 2, 1);
      const sink = ac.createGain(); sink.gain.value = 0;
      const levels = [];
      proc.onaudioprocess = e => {
        const L = e.inputBuffer.getChannelData(0);
        const R = e.inputBuffer.numberOfChannels > 1 ? e.inputBuffer.getChannelData(1) : L;
        let energy = 0;
        for (let i = 0; i < L.length; i++) {
          const v = (L[i] + R[i]) * 0.5; energy += v * v;
        }
        levels.push({ at: performance.now(), rms: Math.sqrt(energy / L.length) });
      };
      b.roomOut.connect(proc); proc.connect(sink); sink.connect(ac.destination);
      try {
        await new Promise(resolve => setTimeout(resolve, 450));
        const fired = performance.now();
        const p = g.capy.position;
        g.sfx('thud', { at: { x: p.x, y: p.y, z: p.z }, force: true, volume: 2 });
        await new Promise(resolve => setTimeout(resolve, 1800));
        const pre = levels.filter(x => x.at < fired).map(x => x.rms);
        const after = levels.filter(x => x.at >= fired + 40 && x.at < fired + 1600).map(x => x.rms);
        const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
        return { chapter: name, room: g.hud.roomAudit(), musicRoom: g.music.room, audio: ac.state,
          beforeSamples: pre.length, afterSamples: after.length,
          baseline: mean(pre), peak: Math.max(0, ...after),
          roomNodeSeconds: b.roomConv.buffer?.duration || 0,
          error: g.state.lastError || null };
      } finally {
        b.roomOut.disconnect(proc); proc.disconnect(); sink.disconnect();
        proc.onaudioprocess = null;
      }
    }, chapter);
    out.rows.push(row);
    await h.result('homecoming-room-signal', out);
    console.log(JSON.stringify({ chapter, baseline: row.baseline, peak: row.peak,
      samples: row.afterSamples, room: row.room.biome }));
    assert.equal(row.room.biome, chapter);
    assert.equal(row.musicRoom, chapter);
    assert.equal(row.audio, 'running');
    assert.ok(row.beforeSamples >= 5 && row.afterSamples >= 15 && !row.error);
    assert.ok(row.peak > Math.max(0.00005, row.baseline * 3),
      chapter + ' effects-return tail must respond to a live thud');
  }
  assert.deepEqual(h.metadata.errors, []);
  out.pass = true;
  await h.result('homecoming-room-signal', out);
} finally { await h.close(); }
