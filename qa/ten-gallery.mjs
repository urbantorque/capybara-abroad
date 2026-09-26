// The README gallery (ROADMAP-TEN U3b). Headful, real GPU, rung 0, 1600x900.
// Canvas only (the HUD is DOM and is not in it), drawn and read back in one
// task, saved as JPEG (quality 0.86) straight from the page to the folder
// given. These are CANDIDATES: each is read by eye, the best are copied to
// docs/images/ by hand, and the rest are thrown away.
//   node qa/ten-gallery.mjs <outDir> [shot,shot,...]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { openHarness } from './reimagine-harness.mjs';
const outDir = process.argv[2];
if (!outDir) throw new Error('usage: node qa/ten-gallery.mjs <outDir> [shots]');
mkdirSync(outDir, { recursive: true });
process.env.CAPY_QA_MUTE_AUDIO = '1'; process.env.CAPY_QA_NO_THROTTLE = '1';
const h = await openHarness({ width: 1600, height: 900 });
const { page } = h;
const put = (x, z, yaw) => page.evaluate(([x, z, yaw]) => {
  const g = window.__capy, y = g.groundY(x, z), b = g.capy.body;
  b.position.set(x, (y === y ? y : b.position.y) + 0.8, z); b.velocity.set(0, 0, 0);
  if (typeof yaw === 'number') g.input.camYaw = yaw;
}, [x, z, yaw]);
async function grab(name, pin) {
  const url = await page.evaluate(pin => {
    const g = window.__capy;
    if (pin) {
      g.tick(1e-4, false);
      g.camera.position.set(pin[0], pin[1], pin[2]); g.camera.lookAt(pin[3], pin[4], pin[5]); g.camera.updateMatrixWorld(true);
      g.post.render();
    } else g.tick(1e-4, true);
    return g.renderer.domElement.toDataURL('image/jpeg', 0.86);
  }, pin || null);
  writeFileSync(join(outDir, name + '.jpg'), Buffer.from(url.split(',')[1], 'base64'));
  console.log('shot', name);
}
const SHOTS = {
  'sydney-harbour': async () => { await put(-30, -6, 0); await page.waitForTimeout(3500); await grab('sydney-harbour'); },
  'havoc': async () => {
    await page.evaluate(() => { window.__capy.state.noPests = false; window.__capy.havoc.qaQuiet(); });
    await put(4, 14, 3.1); await page.waitForTimeout(2500);
    await page.evaluate(() => {
      const g = window.__capy, cam = g.camera, p = g.capy.position;
      const fx = p.x - cam.position.x, fz = p.z - cam.position.z, d = Math.hypot(fx, fz) || 1, ux = fx / d, uz = fz / d, rx = uz, rz = -ux;
      g.havoc.qaPose('warden', p.x + ux * 5 + rx * 2.2, p.z + uz * 5 + rz * 2.2, 0);
      g.havoc.qaPose('dog', p.x + ux * 3.2 - rx * 1.8, p.z + uz * 3.2 - rz * 1.8, 0);
      g.havoc.qaPose('gull', p.x + ux * 5.5 - rx * 0.4, p.z + uz * 5.5 - rz * 0.4, 2.6);
    });
    await page.waitForTimeout(500); await grab('havoc');
    await page.evaluate(() => { window.__capy.state.noPests = true; });
  },
  'kyoto-torii': async () => {
    await h.arrive('kyoto'); await page.waitForTimeout(2500);
    const P = await page.evaluate(() => window.__capy.kyoto.toriiPath());
    await put(P[10], P[11]); await page.waitForTimeout(5000); await grab('kyoto-torii');
  },
  'kyoto-lane': async () => { await h.arrive('kyoto'); await page.waitForTimeout(3500); await grab('kyoto-lane'); },
  'iceland-aurora': async () => {
    await h.arrive('iceland'); await page.waitForTimeout(2500);
    await put(-40, -10); await page.waitForTimeout(3000);
    await page.evaluate(() => window.__capy.iceland.auroraForce(1)); await page.waitForTimeout(5000);
    await page.evaluate(() => window.__capy.iceland.auroraCall()); await page.waitForTimeout(2200);
    await grab('iceland-aurora');
  },
  'venice-loggia': async () => { await h.arrive('venice'); await page.waitForTimeout(2500); await put(-17.4, -18.4); await page.waitForTimeout(3000); await grab('venice-loggia'); },
  'kowloon-night': async () => { await h.arrive('kowloon'); await page.waitForTimeout(4000); await grab('kowloon-night'); },
  'pasto-colcha': async () => { await h.arrive('pasto'); await page.waitForTimeout(4000); await grab('pasto-colcha', [-20, 60, 60, 170, 0, -120]); },
  'goreme-dawn': async () => { await h.arrive('goreme'); await page.waitForTimeout(4500); await grab('goreme-dawn'); },
  'antarctic': async () => { await h.arrive('antarctic'); await page.waitForTimeout(4500); await grab('antarctic'); },
  'monaco': async () => { await h.arrive('monaco'); await page.waitForTimeout(4500); await grab('monaco'); },
  'hanoi': async () => { await h.arrive('hanoi'); await page.waitForTimeout(4500); await grab('hanoi'); },
  'rio': async () => { await h.arrive('rio'); await page.waitForTimeout(4500); await grab('rio'); },
};
const want = (process.argv[3] || Object.keys(SHOTS).join(',')).split(',');
try {
  await h.start();
  await page.waitForFunction(() => window.__capy.havocOK(), null, { timeout: 40000 });
  await page.evaluate(() => { window.__capy.state.noPests = true; window.__capy.state.noHavoc = true; });
  for (const k of want) { try { await SHOTS[k](); } catch (e) { console.log('skip', k, String(e).slice(0, 120)); } }
} finally { await h.close(); }
