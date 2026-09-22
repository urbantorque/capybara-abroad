// Audio-clock smoke and A/B density windows, not listening approval.
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';
const places = process.argv.slice(2);
assert(places.length && places.every(n => ['pasto','cali','rio','sahara','venice','kowloon','monaco'].includes(n)));
const h = await openHarness(), out = { metadata: h.metadata, windows: [] };
const snap = () => h.page.evaluate(() => ({ audio: window.__capy.musAudit(),
  live: window.__capy.music.live, beats: window.__capy.music.beats(),
  time: performance.now(), focus: document.hasFocus() && !document.hidden,
  error: window.__capy.state.lastError }));
try {
  await h.start();
  for (const chapter of places) {
    await h.arrive(chapter); await h.page.bringToFront();
    for (const cut of [true,false]) {
      await h.page.evaluate(cut => { window.__capy.state.noSereneScore = cut; }, cut);
      await h.page.waitForTimeout(3500); // drain the previous rhythm lookahead
      const before = await snap(); await h.page.waitForTimeout(16000); const after = await snap();
      assert(before.live && after.live && before.focus && after.focus && !after.error);
      if (chapter !== 'pasto') assert(after.beats > before.beats, 'regional beat clock advances');
      const bars = after.audio.bandBars-before.audio.bandBars, hits = after.audio.bandHits-before.audio.bandHits;
      if (chapter !== 'pasto') assert(bars > 0 && hits > 0, 'band still schedules');
      out.windows.push({ chapter, cut, before, after, bars, hits, hitsPerBar: bars ? hits/bars : null });
      console.log(JSON.stringify({ chapter, cut, bars, hits }));
    }
  }
  assert.equal(h.metadata.errors.length, 0); out.pass = true;
} catch (e) { out.failure = String(e.stack || e); out.pass = false; process.exitCode = 1; }
finally { await h.result('homecoming-regional-' + places.join('-'), out); await h.close(); }
