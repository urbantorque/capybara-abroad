// The car is a car (ROADMAP-TEN U1b, 26 Sep 2026). Headful on the real GPU.
// A driver with real keys (W/S/A/D held, re-sent each 80 ms) steers for a
// point on the lap 18 m ahead of where the car is. Checks:
//   1. it drives a full lap and the lap counts, in under three minutes
//   2. it can leave the road: a deliberate excursion off the tarmac and back
//   3. it can reverse
//   4. it never leaves the world: no NaN, never below the sea
// Screenshots at speed, off the road, and on the podium line.
//   node qa/ten-u1b-drive.mjs [tag]
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';
const tag = process.argv[2] || 'a';
process.env.CAPY_QA_MUTE_AUDIO = '1'; process.env.CAPY_QA_NO_THROTTLE = '1';
const h = await openHarness({ width: 1280, height: 720 });
const { page } = h;
let checks = 0;
const ok = (c, m, d) => { console.log(c ? 'ok' : 'FAIL', m, d !== undefined ? JSON.stringify(d) : ''); assert.ok(c, m); checks++; };
const race = () => page.evaluate(() => window.__capy.monaco.race());
const keys = { KeyW: false, KeyS: false, KeyA: false, KeyD: false };
async function setKey(k, on) { if (keys[k] === on) return; keys[k] = on; if (on) await page.keyboard.down(k); else await page.keyboard.up(k); }
async function allUp() { for (const k of Object.keys(keys)) await setKey(k, false); }
// steer for the lap 18 m ahead, or for a given world point
async function drive(ms, opts = {}) {
  const t0 = Date.now(); let worst = 0, lowY = 1e9, nan = false;
  while (Date.now() - t0 < ms) {
    const r = await race();
    if (!Number.isFinite(r.fx) || !Number.isFinite(r.fz)) nan = true;
    lowY = Math.min(lowY, r.fy);
    let tx, tz;
    if (opts.to) { tx = opts.to.x; tz = opts.to.z; }
    else { const p = await page.evaluate(s => window.__capy.monaco.trackAt(s), r.s + (opts.ahead || 18)); tx = p.x; tz = p.z; }
    const want = Math.atan2(tx - r.fx, tz - r.fz);
    let err = want - r.yaw; while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI;
    // yaw falls with D (right): steer toward the error
    await setKey('KeyD', err < -0.06); await setKey('KeyA', err > 0.06);
    const fast = Math.abs(err) > 0.7 && r.v > (opts.corner || 14);
    await setKey('KeyW', !fast && !opts.coast); await setKey('KeyS', fast);
    worst = Math.max(worst, Math.abs(r.lat));
    if (process.env.DRIVE_LOG && (Date.now() - t0) % 3000 < 90) console.log('t', ((Date.now() - t0) / 1000).toFixed(1), 's', r.s, 'dist', r.dist, 'v', r.v, 'road', r.road, 'lat', r.lat, 'xz', r.fx, r.fz, 'err', err.toFixed(2), 'hit', r.hit, 'y', r.fy);
    if (opts.until && opts.until(r)) break;
    await page.waitForTimeout(80);
  }
  return { worst, lowY, nan };
}
const out = {};
try {
  await h.start();
  await h.arrive('monaco');
  await page.waitForTimeout(1500);
  // into the car at the grid (the door is the E key within 4.2 m; the probe
  // stands the animal at the door and presses E for real)
  await page.evaluate(() => {
    const g = window.__capy, c = g.monaco.gridCar(), b = g.capy.body;
    b.position.set(c.x + 2.5, b.position.y + 0.5, c.z); b.velocity.set(0, 0, 0);
  });
  await page.waitForTimeout(600);
  await h.hold('KeyE', 300);
  await page.waitForTimeout(400);
  let r = await race();
  ok(r.on && r.free, 'E at the door takes the wheel of the free car', { on: r.on, free: r.free });
  await page.waitForTimeout(3400);   // the lights
  const tLap0 = Date.now();
  const d1 = await drive(40000, { until: q => q.dist > 180 });
  await h.screenshot('ten-u1b-' + tag + '-speed');
  r = await race();
  out.speed = r.v;
  ok(r.v > 12, 'it gets up to speed on the straights', { v: r.v, dist: r.dist });
  // the excursion: aim 25 m off the right of the road for two seconds
  const off = await page.evaluate(() => { const g = window.__capy, q = g.monaco.race(); const t = g.monaco.trackAt(q.s + 12);
    return { x: t.x + Math.cos(t.yaw) * 22, z: t.z - Math.sin(t.yaw) * 22 }; });
  await drive(2600, { to: off, corner: 99 });
  r = await race();
  out.offRoad = { road: r.road, lat: r.lat };
  await h.screenshot('ten-u1b-' + tag + '-off');
  ok(!r.road || Math.abs(r.lat) > 4.4, 'it can leave the road', out.offRoad);
  // reverse: S held from a stop
  await allUp(); await setKey('KeyS', true); await page.waitForTimeout(2500); await setKey('KeyS', false);
  await page.waitForTimeout(1500);
  await setKey('KeyS', true); await page.waitForTimeout(1500);
  r = await race(); await setKey('KeyS', false);
  out.reverse = r.v; console.log('rev', JSON.stringify(r));
  ok(r.v < -0.5, 'S held at a standstill reverses', { v: r.v });
  // back to the lap and round to the line
  const d2 = await drive(170000, { until: q => q.lap >= 1 });
  await allUp();
  r = await race();
  const lapS = (Date.now() - tLap0) / 1000;
  out.lap = { lap: r.lap, s: lapS, passed: r.passed, done: r.done };
  await h.screenshot('ten-u1b-' + tag + '-line');
  ok(r.lap >= 1 && r.done, 'a full lap counts', out.lap);
  ok(lapS < 180, 'inside three minutes', lapS);
  ok(!d1.nan && !d2.nan && Math.min(d1.lowY, d2.lowY) > -3, 'it never leaves the world', { lowY: Math.min(d1.lowY, d2.lowY) });
  out.checks = checks;
  await h.result('ten-u1b-' + tag, out);
  console.log('DRIVE: ' + checks + ' checks passed', JSON.stringify(out));
} finally { await h.close(); }
