// Full-progress audio fixture, not proof that tasks were earned through play.
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';
const h = await openHarness();
const tag = process.argv[2] || 'v2';
assert(/^[\w-]+$/.test(tag));
const out = { metadata: h.metadata, windows: [] };
const counts = a => [a.secondN, a.pulseN, a.ostN];
try {
  await h.start();
  await h.page.evaluate(() => {
    const g = window.__capy;
    for (const id of ['opera-stage', 'steal-hat', 'picnic-thief']) g.completeTask(id, true);
  });
  // Give the arrival statement its authored ending before measuring layers.
  await h.page.waitForTimeout(35000);
  for (const cut of [true, false]) {
    await h.page.bringToFront();
    await h.page.evaluate(cut => { window.__capy.state.noSereneScore = cut; }, cut);
    await h.page.waitForTimeout(1500);
    const before = await h.page.evaluate(() => ({ music: window.__capy.musAudit(), theme: window.__capy.musThemeAudit() }));
    for (let i = 0; i < 3; i++) {
      await h.hold(i % 2 ? 'KeyS' : 'KeyW', 400);
      await h.page.waitForTimeout(9600);
    }
    const after = await h.page.evaluate(() => ({ music: window.__capy.musAudit(), theme: window.__capy.musThemeAudit(),
      focused: document.hasFocus(), hidden: document.hidden, live: window.__capy.music.live }));
    const delta = counts(after.music).map((n, i) => n - counts(before.music)[i]);
    const walk = after.theme.walkN - before.theme.walkN;
    out.windows.push({ cut, before, after, delta, walk });
    assert.equal(after.music.chapProg, 1, 'full-progress fixture active');
    assert(after.live && after.focused && !after.hidden, 'running audio in foreground');
    if (cut) assert(delta[1] > 0, 'positive control schedules inherited progress pulse');
    else assert(delta.every(n => n === 0) && walk === 0, 'no accumulated layers scheduled');
    console.log(JSON.stringify({ cut, delta, walk, scheduler: after.theme.tickMs }));
  }
  assert.equal(h.metadata.errors.length, 0, 'no runtime errors');
  out.pass = true;
} catch (e) { out.pass = false; out.failure = String(e.stack || e); process.exitCode = 1; }
finally {
  try { await h.result('homecoming-score-live-' + tag, out); }
  finally { await h.close(); }
  console.log(JSON.stringify({ pass: out.pass, failure: out.failure }));
}
