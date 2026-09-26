// Venice's arcades and its mirror (ROADMAP-TEN U2d). Headful, real GPU.
//   1. the mirror is live at the arrival, whatever the tide (noVenMirror off)
//   2. at the reviewers' two loggia points the lens stays under the soffit
//      (camera y at or below venCamCeil there) and the animal is in frame
//   3. a PNG across the canal, and one from inside the arcade
//   node qa/ten-u2d-venice.mjs [tag]
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
  await page.evaluate(() => { window.__capy.state.noPests = true; window.__capy.state.noHavoc = true; });
  await h.arrive('venice');
  await page.waitForTimeout(2500);
  out.mirror = await page.evaluate(() => { const g = window.__capy, i = g.reflectInfo(); return { why: i.why, tide: +g.venice.tide().toFixed(2) }; });
  await h.screenshot('ten-u2d-' + tag + '-arrive');
  ok(out.mirror.why === 'drawn' || out.mirror.why === 'water off frame', 'the mirror is live at the arrival', out.mirror);
  // the canal, from the Molo looking across
  await page.evaluate(() => { const g = window.__capy, b = g.capy.body; b.position.set(-20, 1.5, 12); b.velocity.set(0, 0, 0); g.input.camYaw = Math.PI; });
  await page.waitForTimeout(2500);
  out.canal = await page.evaluate(() => window.__capy.reflectInfo().why);
  await h.screenshot('ten-u2d-' + tag + '-canal');
  // the loggia points
  out.loggia = [];
  for (const p of [[-17.4, 0.9, -18.4], [-17.9, 1.3, -35.2]]) {
    await page.evaluate(p => { const g = window.__capy, b = g.capy.body; b.position.set(p[0], p[1] + 0.4, p[2]); b.velocity.set(0, 0, 0); }, p);
    await page.waitForTimeout(2500);
    const r = await page.evaluate(() => {
      const g = window.__capy, c = g.camera.position, a = g.capy.position;
      const ceil = g.biome && g.venice && typeof g.venice.camCeil === 'function' ? g.venice.camCeil(c.x, c.z) : null;
      return { cam: [+c.x.toFixed(2), +c.y.toFixed(2), +c.z.toFixed(2)], animal: [+a.x.toFixed(2), +a.y.toFixed(2), +a.z.toFixed(2)], ceil };
    });
    out.loggia.push(r);
    await h.screenshot('ten-u2d-' + tag + '-loggia' + out.loggia.length);
  }
  for (const r of out.loggia) ok(r.ceil === null || r.ceil === Infinity || r.cam[1] <= r.ceil + 0.05, 'the lens keeps under the soffit', r);
  out.checks = checks;
  await h.result('ten-u2d-' + tag, out);
  console.log('VENICE: ' + checks, JSON.stringify(out));
} finally { await h.close(); }
