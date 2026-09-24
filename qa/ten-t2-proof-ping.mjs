// ROADMAP-TEN T2 proof slot: the cave's ping on a real clock, headful, rung 0.
//   CAPY_QA_URL=http://localhost:5199/ node qa/ten-t2-proof-ping.mjs
// The animal held in the dark passage (32, -14) and the lens pinned in
// post.render on the east wall (ten-t2f-ping-shot's wall lens). One wheek,
// then the page (HUD and all) at 0.4, 0.8, 1.1 and 1.6 s with game.cave.ping()
// read beside each: how many glints are lit when the picture is taken.
// Pictures qa/ten-t2-proof-ping-t<ms>.png, numbers qa/ten-t2-proof-ping.json.png.
import { openHarness } from './reimagine-harness.mjs';

process.env.CAPY_QA_MUTE_AUDIO = '1';
process.env.CAPY_QA_NO_THROTTLE = '1';
const LENS = process.env.CAPY_PING_LENS || 'wall';
const h = await openHarness({ url: process.env.CAPY_QA_URL || 'http://localhost:5199/', width: 1280, height: 720 });
const page = h.page, out = { lens: LENS, frames: [] };
try {
  await h.start();
  await h.arrive('cave');
  await page.bringToFront();
  await page.waitForTimeout(3000);
  await page.evaluate(lens => {
    const g = window.__capy, raw = g.post.render;
    g.post.render = function () {
      const b = g.capy.body, h = g.cave.terrainHeight(32, -14);
      b.position.set(32, h + 0.6, -14); b.velocity.set(0, 0, 0);
      if (lens === 'wall') { g.camera.position.set(18, h + 4.5, 2); g.camera.lookAt(44, h + 2, -24); }
      else { g.camera.position.set(32, h + 8, -5); g.camera.lookAt(32, h, -30); }
      g.camera.updateMatrixWorld(true);
      return raw.apply(this, arguments);
    };
  }, LENS);
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.__capy.events.emit('capy:wheek'));
  const t0 = Date.now();
  for (const ms of [400, 800, 1100, 1600]) {
    await page.waitForTimeout(Math.max(0, ms - (Date.now() - t0)));
    const ping = await page.evaluate(() => window.__capy.cave.ping());
    await h.screenshot(`ten-t2-proof-ping-${LENS}-t${ms}`);
    out.frames.push({ ms, at: Date.now() - t0, ping });
  }
  out.rung = await page.evaluate(() => window.__capy.state.perfRung);
  out.lastError = await page.evaluate(() => window.__capy.state.lastError || null);
  out.errors = h.metadata.errors;
  await h.result('ten-t2-proof-ping-' + LENS, out);
  console.log(JSON.stringify(out));
} finally { await h.close(); }
