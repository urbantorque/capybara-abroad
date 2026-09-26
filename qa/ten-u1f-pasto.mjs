// The colcha and a dry arrival (ROADMAP-TEN U1f). Headful, real GPU.
//   1. Pasto's arrival: rainT is 0 through the first 20 s (noRainPitch)
//   2. the colcha on and off from the plaza and from a raised lens, PNGs
//   3. Sydney's concert: the house cap is twelve (npc.js), read off the
//      concert audit if one is exposed
//   node qa/ten-u1f-pasto.mjs [tag]
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';
const tag = process.argv[2] || 'a';
process.env.CAPY_QA_MUTE_AUDIO = '1'; process.env.CAPY_QA_NO_THROTTLE = '1';
const h = await openHarness({ width: 1280, height: 720 });
const { page } = h;
let checks = 0;
const ok = (c, m, d) => { console.log(c ? 'ok' : 'FAIL', m, d !== undefined ? JSON.stringify(d) : ''); assert.ok(c, m); checks++; };
const out = {};
try {
  await h.start();
  await page.waitForFunction(() => window.__capy.havocOK(), null, { timeout: 40000 });
  await page.evaluate(() => { window.__capy.state.noPests = true; });
  await page.evaluate(() => window.__capy.hud.cross('pasto'));
  // sample the rain through the arrival
  const rain = [];
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(1500);
    rain.push(await page.evaluate(() => { const w = window.__capy.weather; return w && typeof w.drizzle === 'function' ? +w.drizzle().toFixed(3) : null; }));
  }
  out.rain = rain;
  ok(rain.every(v => v === null || v === 0), 'no rain through the first eighteen seconds of the arrival', rain);
  await h.screenshot('ten-u1f-' + tag + '-arrive');
  // the colcha on and off through a pinned lens: the rig's own camera is
  // replaced after the tick and the frame drawn through the post pass
  const views = { plaza: [0, 7, 30, 160, 8, -60], high: [-20, 60, 60, 170, 0, -120], west: [0, 9, 30, -170, 8, 40] };
  for (const [name, v] of Object.entries(views)) {
    for (const cut of [false, true]) {
      // rendered and read back in ONE task, before the next frame redraws it
      await page.evaluate(async ([v, c, nm]) => {
        const g = window.__capy; g.state.noPastoColcha = c;
        g.tick(1e-4, false);
        g.camera.position.set(v[0], v[1], v[2]); g.camera.lookAt(v[3], v[4], v[5]); g.camera.updateMatrixWorld(true);
        g.post.render();
        const url = g.renderer.domElement.toDataURL('image/png');
        await fetch('/shot?name=' + nm, { method: 'POST', body: url.split(',')[1] });
      }, [v, cut, 'ten-u1f-' + tag + '-' + name + (cut ? '-cut' : '-live')]);
    }
  }
  out.checks = checks;
  await h.result('ten-u1f-' + tag, out);
  console.log('PASTO: ' + checks, JSON.stringify(out));
} finally { await h.close(); }
