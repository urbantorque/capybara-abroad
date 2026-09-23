// AAA pass: the mischief beat and the take under REAL keys. Sydney, fresh
// Free Roam, sprint at the bin the bin-chicken hint points to until the task
// ticks. The page's punch() and the startle bus are observed (wrapped and
// listened to, never replaced) so the log says what the knock-over did.
//   node qa/aaa-bin.mjs [tag]
import { openHarness } from './reimagine-harness.mjs';

const tag = process.argv[2] || 'bin';
process.env.CAPY_QA_MUTE_AUDIO = '1'; process.env.CAPY_QA_NO_THROTTLE = '1';
const h = await openHarness({ width: 1280, height: 720 });
const out = { tag, log: [], punches: [], startles: 0, takeSeen: false, tipped: false };
try {
  await h.start(); await h.arrive('sydney'); await h.page.bringToFront();
  await h.page.waitForTimeout(2500);
  await h.page.evaluate(() => {
    const g = window.__capy, raw = g.punch;
    window.__aaa = { punches: [], startles: 0, take: false };
    g.punch = function (a, f) { window.__aaa.punches.push([+g.state.time.toFixed(2), a, f]); return raw.apply(this, arguments); };
    window.__aaa.shapes = [];
    g.events.on('npc:startled', (e) => { window.__aaa.startles++; const r = (e && e.npc) || e; const gp = r && r.group && r.group.position; const c = g.capy.position; window.__aaa.shapes.push({ keys: r ? Object.keys(r).slice(0, 12).join(',') : null, group: !!(r && r.group), d: gp ? +Math.hypot(gp.x - c.x, gp.z - c.z).toFixed(1) : null, rung: g.state.perfRung }); });
    // the take pool: the one 12-instance InstancedMesh added loose to the scene
    setInterval(() => {
      g.scene.traverse(o => { if (o.isInstancedMesh && o.count === 12 && o.visible) window.__aaa.take = true; });
    }, 50);
  });
  const held = new Set();
  const setKeys = async want => {
    for (const k of [...held]) if (!want.has(k)) { await h.page.keyboard.up(k); held.delete(k); }
    for (const k of want) if (!held.has(k)) { await h.page.keyboard.down(k); held.add(k); }
  };
  const t0 = Date.now(); let n = 0, shot = 0;
  while (Date.now() - t0 < 40000) {
    const s = await h.page.evaluate(() => {
      const g = window.__capy, t = g.hintTarget('bin-chicken'); if (!t) return null;
      const hp = t.position || t.pos || t, p = g.capy.body.position;
      const dx = hp.x - p.x, dz = hp.z - p.z, d = Math.hypot(dx, dz);
      const cd = new g.THREE.Vector3(); g.camera.getWorldDirection(cd); cd.y = 0; cd.normalize();
      return { d: +d.toFixed(2), f: (dx * cd.x + dz * cd.z) / (d || 1), r: (dx * -cd.z + dz * cd.x) / (d || 1), done: g.taskDone('bin-chicken') };
    });
    if (!s) { out.log.push('no target'); break; }
    if (s.done) { out.tipped = true; out.log.push('ticked at ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s'); break; }
    const want = new Set();
    if (s.f > 0.2) want.add('KeyW'); else if (s.f < -0.6) want.add('KeyS');
    if (s.r > 0.2) want.add('KeyD'); else if (s.r < -0.2) want.add('KeyA');
    want.add('ShiftLeft');
    await setKeys(want);
    if (s.d < 3 && shot < 6) { await h.screenshot(`aaa-${tag}-near-${shot++}`); }
    if (n++ % 10 === 0) out.log.push({ d: s.d });
    await h.page.waitForTimeout(90);
  }
  await setKeys(new Set());
  for (let i = 0; i < 4; i++) { await h.page.waitForTimeout(140); await h.screenshot(`aaa-${tag}-after-${i}`); }
  const a = await h.page.evaluate(() => window.__aaa);
  out.punches = a.punches; out.shapes = a.shapes; out.startles = a.startles; out.takeSeen = a.take;
  out.errors = h.metadata.errors;
  await h.result(`aaa-${tag}`, out);
  console.log(JSON.stringify({ tipped: out.tipped, punches: out.punches, startles: out.startles, takeSeen: out.takeSeen, shapes: out.shapes, errors: out.errors.length, log: out.log.slice(-3) }));
} finally { await h.close(); }
