// Audio-clock reservations under real input; this is not listening approval.
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';
const chapter = process.argv[2] || 'sydney';
assert(['sydney', 'kyoto', 'iceland', 'hanoi'].includes(chapter));
const h = await openHarness();
const out = { chapter, metadata: h.metadata, events: [], samples: [] };
try {
  await h.start(); await h.arrive(chapter);
  let last = await h.page.evaluate(() => window.__capy.musAudit().space.phrases);
  for (let i = 0; i < 180; i++) {
    if (i % 20 === 0) await h.hold(i % 40 ? 'KeyS' : 'KeyW', 400);
    await h.page.waitForTimeout(1000);
    const s = await h.page.evaluate(() => ({ ...window.__capy.musAudit().space,
      throws: window.__capy.musAudit().throws, live: window.__capy.music.live,
      focused: document.hasFocus(), hidden: document.hidden }));
    out.samples.push(s);
    assert(s.live && s.focused && !s.hidden && !s.throws, 'live, foreground, error-free audio');
    if (s.phrases !== last) {
      assert.equal(s.phrases, last + 1, 'every reservation observed');
      const prior = out.events.at(-1);
      if (prior) {
        assert(s.start >= prior.until, 'full phrase tail and rest respected');
        if (chapter === 'kyoto' || chapter === 'hanoi') assert(s.role !== prior.role, 'local colour alternates');
      }
      assert(s.until - s.end >= s.rest - .001, 'reserved silence after tail');
      out.events.push(s); last = s.phrases;
      console.log(JSON.stringify({ chapter, event: s }));
    }
    if (out.events.length >= 2) break;
    if (i % 30 === 29) console.log(JSON.stringify({ chapter, seconds: i + 1, phrases: out.events.length }));
  }
  assert(out.events.length >= 2, 'two phrases actually scheduled, not permanent silence');
  out.theme = await h.page.evaluate(() => window.__capy.musThemeAudit());
  assert.equal(h.metadata.errors.length, 0);
  out.pass = true;
} catch (e) { out.pass = false; out.failure = String(e.stack || e); process.exitCode = 1; }
finally {
  try { await h.result('homecoming-space-' + chapter, out); }
  finally { await h.close(); }
  console.log(JSON.stringify({ chapter, pass: out.pass, failure: out.failure, events: out.events.length }));
}
