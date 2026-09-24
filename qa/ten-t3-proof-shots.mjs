// ROADMAP-TEN T3 proof slot: one headful picture of each item's payoff at
// rung 0 (prefs pf 1), real clock, real rAF, page.screenshot (HUD and all).
//   node qa/ten-t3-proof-shots.mjs <free|ibis|cameo|kyoto|hanoi|kowloon>
// Pictures: qa/ten-t3-proof-<mode>-*.png; state: qa/ten-t3-proof-<mode>.json.png.
import { openHarness } from './reimagine-harness.mjs';

const mode = process.argv[2] || 'free';
process.env.CAPY_QA_MUTE_AUDIO = '1';
process.env.CAPY_QA_NO_THROTTLE = '1';
const story = mode === 'ibis' || mode === 'cameo';
const h = await openHarness({ width: 1280, height: 720, story });
const { page } = h;
const out = { mode, errors: h.metadata.errors };
const shot = n => h.screenshot('ten-t3-proof-' + mode + '-' + n);
const put = (x, z, lift = 0.6) => page.evaluate(([x, z, lift]) => {
  const g = window.__capy, b = g.capy.body;
  const y = g.biome.current === 'kyoto' && g.kyoto.terrainHeight ? g.kyoto.terrainHeight(x, z) : b.position.y;
  b.position.set(x, y + lift, z); b.velocity.set(0, 0, 0);
  if (b.previousPosition) b.previousPosition.copy(b.position);
  if (b.interpolatedPosition) b.interpolatedPosition.copy(b.position);
}, [x, z, lift]);
const state = () => page.evaluate(() => {
  const g = window.__capy, p = g.capy.position;
  return { biome: g.biome.current, mode: g.state.journeyMode, rung: g.state.perfRung,
    p: [p.x, p.y, p.z].map(v => +v.toFixed(2)), lastError: g.state.lastError || null,
    bubbles: [...document.querySelectorAll('.capyui-bubble, .npc-bubble')].filter(e => e.offsetParent && getComputedStyle(e).opacity > 0.05).length };
});
try {
  await h.start();
  out.start = await state();
  if (mode === 'free') {
    // the sketchbook: a fresh free file, arrival in Sydney then Kyoto
    await page.waitForTimeout(5000);
    out.sydney = await state();
    out.paper = await page.evaluate(() => (document.querySelector('.capyui-todo') || {}).innerText || null);
    await shot('sydney');
    await h.arrive('kyoto');
    await page.waitForTimeout(3000);
    out.kyoto = await state();
    out.paperKyoto = await page.evaluate(() => (document.querySelector('.capyui-todo') || {}).innerText || null);
    await shot('kyoto');
  } else if (mode === 'ibis') {
    // Act I, the watcher, on a fresh story file in Sydney
    await page.waitForTimeout(3000);
    out.act = await page.evaluate(() => ({ act: window.__capy.journeyAct(), grace: window.__capy.graceOn() }));
    await page.evaluate(() => window.__capy.rivalSoon());
    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(500);
      const a = await page.evaluate(() => window.__capy.rivalAudit());
      if (a.state === 'watch' && a.t > 1.5) { out.audit = a; break; }
    }
    out.screen = await page.evaluate(() => {
      const g = window.__capy, s = g.scene.getObjectByName('rivalIbis'), v = new g.THREE.Vector3();
      if (!s) return null;
      s.getWorldPosition(v); v.y += 0.8; v.project(g.camera);
      return { on: Math.abs(v.x) < 1 && Math.abs(v.y) < 1 && v.z < 1, sx: Math.round((v.x + 1) * 640), sy: Math.round((1 - v.y) * 360) };
    });
    out.st = await state();
    await shot('watch');
  } else if (mode === 'cameo') {
    // the traveller at a memory: two Sydney tasks through completeTask
    await page.waitForTimeout(3000);
    await page.evaluate(() => { const g = window.__capy; window.__m = 0; g.events.on('story:memory', () => window.__m++); g.completeTask('steal-hat'); });
    await page.waitForTimeout(3500);
    await page.evaluate(() => window.__capy.completeTask('opera-stage'));
    await page.waitForFunction(() => window.__m > 0, null, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1800);
    out.cameo = await page.evaluate(() => window.__capy.cameoAudit());
    out.st = await state();
    await shot('memory');
    await page.waitForTimeout(4000);
    out.cameo2 = await page.evaluate(() => window.__capy.cameoAudit());
    await shot('memory-later');
  } else if (mode === 'kyoto') {
    await h.arrive('kyoto');
    await page.waitForTimeout(3500);
    out.arrive = await state();
    await shot('arrive');
    const P = await page.evaluate(() => window.__capy.kyoto.toriiPath());
    await put(P[10], P[11]);
    await page.waitForTimeout(5000);
    out.torii = await state();
    await shot('torii5');
  } else if (mode === 'hanoi') {
    await h.arrive('hanoi');
    await page.waitForTimeout(3500);
    out.arrive = await state();
    out.willow = await page.evaluate(() => { const w = window.__capy.hanoi.willow(); delete w.pts; return w; });
    await shot('arrive');
  } else if (mode === 'kowloon') {
    await h.arrive('kowloon');
    await page.waitForTimeout(3500);
    out.arrive = await state();
    await shot('arrive');
    await put(-9.3, 0);
    await page.waitForTimeout(5000);
    out.arcade = await page.evaluate(() => window.__capy.kowloon.arcade());
    out.under = await state();
    await shot('arcade');
  }
  await h.result('ten-t3-proof-' + mode, out);
  console.log(JSON.stringify(out).slice(0, 1800));
} finally { await h.close(); }
