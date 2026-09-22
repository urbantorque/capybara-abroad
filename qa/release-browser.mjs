// ROADMAP-PAGES: real browser smoke, local or published self-contained HTML.
// Only the reflection composition is staged; travel and movement run normally.
import assert from 'node:assert/strict';
import { openHarness, snapshot } from './reimagine-harness.mjs';

const url = process.argv[2] || 'http://localhost:5188/';
const tag = process.argv[3] || 'release-local';
assert(/^[\w-]+$/.test(tag));
const h = await openHarness({ url, pinRung: false });
const out = { url, metadata: h.metadata, checks: [], reflections: null };
const check = (ok, message) => { assert(ok, message); out.checks.push(message); };
const settings = async () => {
  await h.page.keyboard.press('Escape');
  if (!await h.page.getByRole('slider', { name: 'performance', exact: true }).isVisible())
    await h.page.getByRole('button', { name: 'settings', exact: true }).click();
};
const pickQuality = async value => {
  const slider = h.page.getByRole('slider', { name: 'performance', exact: true });
  await slider.scrollIntoViewIfNeeded();
  const box = await slider.boundingBox();
  await slider.click({ position: { x: value === 1 ? box.width / 2 : box.width - 2, y: box.height / 2 } });
};
try {
  await h.start();
  const first = await snapshot(h.page);
  await h.hold('KeyW', 1300);
  const walked = await snapshot(h.page);
  check(Math.hypot(walked.position.x - first.position.x, walked.position.z - first.position.z) > 0.3,
    'trusted movement changes position');
  out.opening = walked;
  // Public crossing invokes the same arrival flow as the departure board.
  await h.arrive('kyoto');
  await h.hold('KeyD', 300);
  const music0 = await h.page.evaluate(() => window.__capy.musAudit());
  await h.page.waitForTimeout(8000);
  const music1 = await h.page.evaluate(() => window.__capy.musAudit());
  out.music = { before: music0, after: music1 };
  out.audio = await h.page.evaluate(() => window.__capy.musThemeAudit());
  check(out.audio.ac === 'running', 'audio context runs after trusted input');
  check(music1.pad > 0.001 && (music1.themeSaid > 0 || music1.melN > 0 || music1.secondN > 0),
    'score pad is active and musical notes have been scheduled');
  out.auto = await h.page.evaluate(() => ({ perf: window.__capy.perfAudit(), reflection: window.__capy.reflectInfo() }));
  // Real Settings control, not a direct write to the governor.
  await settings();
  const quality = h.page.getByRole('slider', { name: 'performance', exact: true });
  await pickQuality(1);
  check(await quality.getAttribute('aria-valuetext') === 'pretty', 'Pretty selected through Settings');
  check((await h.page.locator('#capyui-perfnote').textContent()).includes('reflections'), 'Settings explains reflections');
  await h.page.keyboard.press('Escape');
  await h.page.evaluate(() => {
    const g = window.__capy, b = g.capy.body;
    b.position.set(26, 0.3, 19.5); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    g.frameShot({ yaw: 0, dist: 11, pitch: 0.34, raise: 1.4, hold: 45 });
  });
  await h.page.waitForTimeout(4500);
  // Frozen-camera, single-turn masked hide-and-diff, adapted from wow-reflect.
  out.reflections = await h.page.evaluate(() => {
    const g = window.__capy, T = g.THREE, waters = [];
    g.scene.traverse(o => {
      for (let p = o; p; p = p.parent) if (!p.visible) return;
      if (o.isMesh && o.material?.userData?.grainReflect > 0) waters.push(o);
    });
    const W = g.renderer.domElement.width, H = g.renderer.domElement.height;
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const grab = () => { ctx.drawImage(g.renderer.domElement, 0, 0); return ctx.getImageData(0, 0, W, H).data; };
    const key = new T.MeshBasicMaterial({ color: 0xff00ff, fog: false });
    const saved = waters.map(w => w.material), oldCut = g.state.noReflect;
    try {
      waters.forEach(w => { w.material = key; });
      g.renderer.setRenderTarget(null); g.renderer.render(g.scene, g.camera);
      const mask = grab();
      waters.forEach((w, i) => { w.material = saved[i]; });
      g.state.noReflect = false; g.reflectDraw(); g.post.render();
      const on = grab(), live = g.reflectInfo();
      g.state.noReflect = true; g.reflectDraw(); g.post.render();
      const off = grab(), cut = g.reflectInfo();
      let pixels = 0, changed = 0, sum = 0;
      for (let i = 0; i < mask.length; i += 4) {
        if (mask[i] > 180 && mask[i + 1] < 90 && mask[i + 2] > 180) {
          pixels++;
          const d = Math.max(...[0, 1, 2].map(j => Math.abs(on[i + j] - off[i + j])));
          sum += d; if (d >= 12) changed++;
        }
      }
      return { live, cut, pixels, changed, mean: pixels ? sum / pixels : 0, perf: g.perfAudit() };
    } finally {
      waters.forEach((w, i) => { w.material = saved[i]; }); key.dispose();
      g.state.noReflect = oldCut; g.reflectDraw(); g.post.render();
    }
  });
  check(out.reflections.live.drawn && out.reflections.pixels > 100 && out.reflections.changed > 100,
    'Kyoto reflections visibly change water pixels');
  await h.screenshot(tag + '-reflections');
  await settings();
  await pickQuality(2);
  await h.page.keyboard.press('Escape');
  await h.page.waitForTimeout(600);
  out.fast = await h.page.evaluate(() => ({ perf: window.__capy.perfAudit(), reflection: window.__capy.reflectInfo() }));
  check(out.fast.perf.mode === 'fast' && out.fast.reflection.why === 'parked rung 3', 'Fast intentionally parks mirrors');
  await settings();
  await pickQuality(1);
  await h.page.keyboard.press('Escape');
  await h.arrive('hanoi');
  await h.hold('KeyW', 600);
  await h.page.waitForTimeout(2000);
  out.beforeReload = await snapshot(h.page);
  check(!!out.beforeReload.save, 'journey saved on public origin');
  await h.page.reload({ waitUntil: 'load' });
  await h.page.waitForFunction(() => !!window.__capy && !!document.querySelector('.capyui-go'));
  await h.start();
  out.afterReload = await snapshot(h.page);
  check(out.afterReload.chapter === 'hanoi', 'reload resumes the saved chapter');
  check((await h.page.evaluate(() => window.__capy.perfAudit())).mode === 'pretty', 'Pretty preference survives reload');
  await h.screenshot(tag + '-resume');
  check(h.metadata.errors.length === 0, 'no browser runtime or console errors');
  check(h.metadata.requests.length === 0, 'no failed requests');
  out.pass = true;
} catch (error) {
  out.pass = false; out.failure = String(error.stack || error); process.exitCode = 1;
} finally {
  // Never POST test output to the public hosting origin.
  await fetch('http://localhost:5188/shot?name=' + tag + '.json', {
    method: 'POST', body: Buffer.from(JSON.stringify(out, null, 2)).toString('base64') });
  console.log(JSON.stringify({ pass: out.pass, checks: out.checks, reflections: out.reflections,
    auto: out.auto, failure: out.failure, errors: h.metadata.errors }, null, 2));
  await h.close();
}
