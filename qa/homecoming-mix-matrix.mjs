// Short per-place score mix census. Diagnostic only: it records balance and
// scheduler health without deciding that a palette should be louder.
import assert from 'node:assert/strict';
import { openHarness, CHAPTERS } from './reimagine-harness.mjs';

const limitArg = process.argv.find(arg => /^--limit=\d+$/.test(arg));
const limit = limitArg ? Math.max(1, Math.min(CHAPTERS.length, Number(limitArg.split('=')[1]))) : CHAPTERS.length;
const tag = process.argv.find(arg => /^--tag=[\w-]+$/.test(arg))?.split('=')[1] || 'current-v1';
const places = CHAPTERS.slice(0, limit);
const h = await openHarness();
const out = { metadata: h.metadata, tag, seconds: 12, places: [] };
try {
  await h.start();
  for (const chapter of places) {
    await h.arrive(chapter);
    const row = await h.page.evaluate(async seconds => {
      const g = window.__capy, stems = g.hud.audioStems(), ac = stems.ac;
      const music = ac.createAnalyser(), sfx = ac.createAnalyser();
      music.fftSize = sfx.fftSize = 1024;
      const before = g.musAudit(), themeBefore = g.musThemeAudit();
      stems.musicFinal.connect(music); stems.sfxFinal.connect(sfx);
      const md = new Float32Array(music.fftSize), sd = new Float32Array(sfx.fftSize);
      let ms = 0, ss = 0, n = 0, maxReduction = 0;
      const t0 = performance.now(), until = t0 + seconds * 1000;
      try {
        while (performance.now() < until) {
          music.getFloatTimeDomainData(md); sfx.getFloatTimeDomainData(sd);
          let mp = 0, sp = 0;
          for (let i = 0; i < md.length; i++) { mp += md[i] * md[i]; sp += sd[i] * sd[i]; }
          ms += mp / md.length; ss += sp / sd.length; n++;
          maxReduction = Math.max(maxReduction, Math.max(0, -(stems.limiter?.reduction || 0)));
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      } finally {
        stems.musicFinal.disconnect(music); stems.sfxFinal.disconnect(sfx);
      }
      const a = g.musAudit(), th = g.musThemeAudit();
      const powerM = Math.max(1e-12, ms / Math.max(1, n));
      const powerS = Math.max(1e-12, ss / Math.max(1, n));
      return { samples: n, musicDb: +(10 * Math.log10(powerM)).toFixed(2),
        sfxDb: +(10 * Math.log10(powerS)).toFixed(2),
        relativeDb: +(10 * Math.log10(powerM / powerS)).toFixed(2),
        limiterMaxReduction: maxReduction, focused: document.hasFocus(), hidden: document.hidden,
        audioState: ac.state, throws: a.throws - before.throws,
        notes: { band: a.bandHits - before.bandHits, melody: a.melN - before.melN,
          theme: th.stmts.full - themeBefore.stmts.full, phrase: a.space.phrases - before.space.phrases },
        chapter: g.biome.current, error: g.state.lastError || null };
    }, out.seconds);
    out.places.push(row);
    assert(row.samples >= 100, chapter + ': enough RMS samples');
    assert.equal(row.audioState, 'running', chapter + ': AudioContext running');
    assert(row.focused && !row.hidden, chapter + ': foreground');
    assert.equal(row.throws, 0, chapter + ': scheduler throws');
    assert.equal(row.error, null, chapter + ': runtime error');
    assert.equal(row.chapter, chapter, chapter + ': correct place');
    await h.result('homecoming-mix-matrix-' + tag, out);
    console.log(JSON.stringify({ chapter, musicDb: row.musicDb, sfxDb: row.sfxDb,
      relativeDb: row.relativeDb, limiter: row.limiterMaxReduction }));
  }
  assert.equal(h.metadata.errors.length, 0, 'no browser errors');
  out.pass = true;
} catch (error) { out.pass = false; out.failure = String(error.stack || error); process.exitCode = 1; }
finally {
  try { await h.result('homecoming-mix-matrix-' + tag, out); } finally { await h.close(); }
  console.log(JSON.stringify({ pass: out.pass, places: out.places.length, failure: out.failure }));
}
