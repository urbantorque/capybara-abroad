// The pests and the arrival card, photographed (ROADMAP-TEN U1a/U1g).
// Headful on the real GPU. Poses each pest in front of the lens (qaPose) so
// the picture can be judged; then crosses to two bright places and catches
// the arrival card while it is up.
//   node qa/ten-u1g-look.mjs [tag] [place,place]
import { openHarness } from './reimagine-harness.mjs';
const tag = process.argv[2] || 'a';
const places = (process.argv[3] || 'sahara,antarctic').split(',');
process.env.CAPY_QA_MUTE_AUDIO = '1'; process.env.CAPY_QA_NO_THROTTLE = '1';
const h = await openHarness({ width: 1280, height: 720 });
const { page } = h;
const out = {};
try {
  await h.start();
  await page.waitForFunction(() => window.__capy.havocOK(), null, { timeout: 40000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const g = window.__capy, cam = g.camera, p = g.capy.position;
    const fx = p.x - cam.position.x, fz = p.z - cam.position.z, d = Math.hypot(fx, fz) || 1;
    const ux = fx / d, uz = fz / d, rx = uz, rz = -ux;
    g.havoc.qaPose('warden', p.x + ux * 5 + rx * 2.2, p.z + uz * 5 + rz * 2.2, 0);
    g.havoc.qaPose('dog', p.x + ux * 3.5 - rx * 2.0, p.z + uz * 3.5 - rz * 2.0, 0);
    g.havoc.qaPose('gull', p.x + ux * 6 - rx * 0.5, p.z + uz * 6 - rz * 0.5, 3.2);
    g.havoc.qaShadow(p.x + ux * 1.5, p.z + uz * 1.5);
  });
  await page.waitForTimeout(600);
  await h.screenshot('ten-u1g-' + tag + '-pests');
  // a flick in flight
  await h.hold('KeyV', 60);
  await page.waitForTimeout(120);
  await h.screenshot('ten-u1g-' + tag + '-pip');
  for (const pl of places) {
    await page.evaluate(n => window.__capy.hud.cross(n), pl);
    // the card is up for a few seconds after the white lifts
    await page.waitForFunction(n => window.__capy.biome.current === n && !!document.querySelector('.capyui-place.show'), pl, { timeout: 40000 }).catch(() => {});
    await page.waitForTimeout(700);
    out[pl] = await page.evaluate(() => {
      const s = document.querySelector('.capyui-placesub'), n = document.querySelector('.capyui-placenews');
      const cs = e => e && e.offsetParent ? { color: getComputedStyle(e).color, bg: getComputedStyle(e).backgroundColor, size: getComputedStyle(e).fontSize, text: e.textContent } : null;
      return { sub: cs(s), news: cs(n), shown: !!document.querySelector('.capyui-place.show') };
    });
    await h.screenshot('ten-u1g-' + tag + '-card-' + pl);
  }
  console.log(JSON.stringify(out, null, 1));
  await h.result('ten-u1g-' + tag, out);
} finally { await h.close(); }
