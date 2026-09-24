// ROADMAP-TEN T2 proof slot: up Arpoador with real keys, headful, rung 0.
//   CAPY_QA_URL=http://localhost:5199/ node qa/ten-t2-proof-rock.mjs
// T2d owed a real-key walk up the rock. The animal starts at posto6 (-44, -5)
// and is steered by a closed loop (camera-relative WASD recomputed every
// 300 ms from the lens's own forward) at the summit, the rock's centre
// (-62, -26), for up to 30 s. Read back: the height it reached against the
// summit's ground, and a picture from its own resting lens at the top.
// Picture qa/ten-t2-proof-rock-top.png, numbers qa/ten-t2-proof-rock.json.png.
import { openHarness } from './reimagine-harness.mjs';

process.env.CAPY_QA_MUTE_AUDIO = '1';
process.env.CAPY_QA_NO_THROTTLE = '1';
const h = await openHarness({ url: process.env.CAPY_QA_URL || 'http://localhost:5199/', width: 1280, height: 720 });
const page = h.page, out = { path: [] };
try {
  await h.start();
  await h.arrive('rio');
  await page.bringToFront();
  await page.evaluate(() => { const g = window.__capy, y = g.rio.terrainHeight(-44, -5); g.capy.body.position.set(-44, y + 0.8, -5); g.capy.body.velocity.set(0, 0, 0) });
  await page.waitForTimeout(2500);
  const goal = { x: -62, z: -26 };
  const t0 = Date.now();
  let held = [];
  while (Date.now() - t0 < 30000) {
    const s = await page.evaluate(q => {
      const g = window.__capy, p = g.capy.body.position, f = new g.THREE.Vector3();
      g.camera.getWorldDirection(f); f.y = 0; f.normalize();
      const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
      const fw = (dx * f.x + dz * f.z) / d, rt = (dx * -f.z + dz * f.x) / d, keys = [];
      if (d > 1.5) { if (fw > 0.3) keys.push('KeyW'); if (fw < -0.3) keys.push('KeyS'); if (rt > 0.3) keys.push('KeyD'); if (rt < -0.3) keys.push('KeyA'); }
      return { keys, d: +d.toFixed(1), x: +p.x.toFixed(1), y: +p.y.toFixed(2), z: +p.z.toFixed(1) };
    }, goal);
    out.path.push([s.x, s.y, s.z, s.d]);
    for (const k of held) if (!s.keys.includes(k)) await page.keyboard.up(k);
    for (const k of s.keys) if (!held.includes(k)) await page.keyboard.down(k);
    held = s.keys;
    if (!s.keys.length) break;
    await page.waitForTimeout(300);
  }
  for (const k of held) await page.keyboard.up(k);
  out.secs = +((Date.now() - t0) / 1000).toFixed(1);
  await page.waitForTimeout(2500);
  out.end = await page.evaluate(() => { const g = window.__capy, p = g.capy.body.position;
    return { x: +p.x.toFixed(1), y: +p.y.toFixed(2), z: +p.z.toFixed(1), ground: +g.rio.terrainHeight(p.x, p.z).toFixed(2),
      summit: +g.rio.terrainHeight(-62, -26).toFixed(2), d: +Math.hypot(p.x + 62, p.z + 26).toFixed(1), rung: g.state.perfRung, lastError: g.state.lastError || null }; });
  await h.screenshot('ten-t2-proof-rock-top');
  out.errors = h.metadata.errors;
  await h.result('ten-t2-proof-rock', out);
  console.log(JSON.stringify({ secs: out.secs, end: out.end, errors: out.errors.length }));
} finally { await h.close(); }
