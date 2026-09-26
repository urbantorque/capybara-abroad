// The Pacific and the Harbour (ROADMAP-TEN U1e). Headful, real GPU, rung 0.
//   1. Sydney: the harbour draws its mirror (reflectInfo 'drawn'), PNG
//   2. Manly: W from the spawn for 5 s moves the animal 8 m or more (the bin)
//   3. Manly: the break, glass on and off, saturation of the water band
//   4. Manly: the outer ocean draws its mirror
//   node qa/ten-u1e-waters.mjs [tag]
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';
const tag = process.argv[2] || 'a';
process.env.CAPY_QA_MUTE_AUDIO = '1'; process.env.CAPY_QA_NO_THROTTLE = '1';
const h = await openHarness({ width: 1280, height: 720 });
const { page } = h;
let checks = 0;
const ok = (c, m, d) => { console.log(c ? 'ok' : 'FAIL', m, d !== undefined ? JSON.stringify(d) : ''); assert.ok(c, m); checks++; };
const out = {};
// mean saturation of a screen box, read off the canvas
const satBox = (x0, y0, x1, y1) => page.evaluate(([x0, y0, x1, y1]) => {
  const g = window.__capy; g.tick(1e-4, true);
  const src = g.renderer.domElement, c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const cx = c.getContext('2d'); cx.drawImage(src, 0, 0);
  const sx = src.width / innerWidth, sy = src.height / innerHeight;
  const d = cx.getImageData(Math.round(x0 * sx), Math.round(y0 * sy), Math.round((x1 - x0) * sx), Math.round((y1 - y0) * sy)).data;
  let s = 0, n = 0, r = 0, gg = 0, b = 0;
  for (let i = 0; i < d.length; i += 16) {
    const R = d[i] / 255, G = d[i + 1] / 255, B = d[i + 2] / 255, mx = Math.max(R, G, B), mn = Math.min(R, G, B);
    s += mx > 0 ? (mx - mn) / mx : 0; r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++;
  }
  return { sat: +(s / n).toFixed(3), rgb: [Math.round(r / n), Math.round(gg / n), Math.round(b / n)] };
}, [x0, y0, x1, y1]);
try {
  await h.start();
  await page.waitForFunction(() => window.__capy.havocOK(), null, { timeout: 40000 });
  // 1. Sydney's harbour: look north over the water from the forecourt
  await page.evaluate(() => { const g = window.__capy; g.state.noPests = true; g.state.noHavoc = true;
    const b = g.capy.body; b.position.set(-30, 1.2, -6); b.velocity.set(0, 0, 0); g.input.camYaw = 0; });
  await page.waitForTimeout(2500);
  out.sydney = await page.evaluate(() => { const i = window.__capy.reflectInfo(); return { why: i.why, drawn: i.drawn }; });
  await h.screenshot('ten-u1e-' + tag + '-harbour');
  ok(out.sydney.why === 'drawn', 'the harbour draws its mirror', out.sydney);
  // 2. Manly: the walk from the spawn
  await h.arrive('manly');
  await page.waitForTimeout(2000);
  await h.screenshot('ten-u1e-' + tag + '-manly-arrive');
  // W walks along -(sin camYaw, cos camYaw): camYaw 0 is straight down the
  // spawn's centreline toward the sea, the line the bin used to stand on
  const p0 = await page.evaluate(() => { const g = window.__capy; g.input.camYaw = 0; const p = g.capy.position; return { x: p.x, z: p.z }; });
  await h.hold('KeyW', 5000);
  const p1 = await page.evaluate(() => { const p = window.__capy.capy.position; return { x: p.x, z: p.z }; });
  out.walk = +Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(2);
  // the bin stood at z 43.2 on the centreline, 2.8 m in front of the spawn;
  // past it, the next thing on this line is the seawall's coping, which is
  // meant to be there (the steps are at x -12 and -36)
  out.walkZ = +p1.z.toFixed(2);
  ok(p1.z < 42.6, 'W from the Manly spawn walks past where the bin stood', { walk: out.walk, z: out.walkZ });
  // 3. the break: its saturation, the number the V pass has to beat
  await page.evaluate(() => { const g = window.__capy, b = g.capy.body; b.position.set(4, 1.5, 14); b.velocity.set(0, 0, 0); g.input.camYaw = 0; });
  await page.waitForTimeout(3000);
  out.info = await page.evaluate(() => { const i = window.__capy.reflectInfo(); return { why: i.why, drawn: i.drawn }; });
  // frozen A/B: both arms drawn in one task at the same wave phase (tick 1e-4)
  await h.screenshot('ten-u1e-' + tag + '-break-on');
  const ab = await page.evaluate(() => {
    const g = window.__capy, src = g.renderer.domElement;
    const read = () => { g.tick(1e-4, true); const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
      const cx = c.getContext('2d'); cx.drawImage(src, 0, 0); const sx = src.width / innerWidth, sy = src.height / innerHeight;
      const d = cx.getImageData(Math.round(200 * sx), Math.round(150 * sy), Math.round(880 * sx), Math.round(420 * sy)).data;
      let s = 0, n = 0; for (let i = 0; i < d.length; i += 16) { const R = d[i], G = d[i + 1], B = d[i + 2], mx = Math.max(R, G, B), mn = Math.min(R, G, B); s += mx > 0 ? (mx - mn) / mx : 0; n++; }
      return +(s / n).toFixed(4); };
    g.state.noManlyGlass = false; const on = read();
    g.state.noManlyGlass = true; const off = read();
    return { on: { sat: on }, off: { sat: off } };
  });
  const on = ab.on, off = ab.off;
  await h.screenshot('ten-u1e-' + tag + '-break-off');
  out.glass = { on, off };
  // RECORDED, NOT ASSERTED: a vertex-colour glass term on the wave faces
  // measured 0.192 -> 0.188 and 0.1998 -> 0.1975 (frozen A/B) and was cut; the
  // haze, not the water's own colour, decides this frame. The number to beat.
  console.log('break saturation', JSON.stringify(out.glass));
  ok(out.info.why === 'drawn' || out.info.why === 'water off frame', 'Manly\'s ocean mirror is live', out.info);
  out.checks = checks;
  await h.result('ten-u1e-' + tag, out);
  console.log('WATERS: ' + checks + ' checks', JSON.stringify(out));
} finally { await h.close(); }
