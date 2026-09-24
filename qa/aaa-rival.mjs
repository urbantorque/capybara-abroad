// AAA A4: the rival ibis, live. Waits for a yuzu on the ground, calls it in
// (game.rivalSoon — only the wait is skipped, every gate holds), then:
//   A. stand still: it steals, flees and gets away (rival:escaped);
//   B. again, chase it with real keys and wheek (Q) inside six metres: it
//      drops the fruit plus one (rival:dropped) and a drop appears.
//   node qa/aaa-rival.mjs [chapter]
// TEN T4a: a fresh file is in the T2a grace (graceOn(): no memory yet, or no
// repertoire name yet on a free file), and in it rivalOK is false, so the bird
// never came and 'A states' read empty. The grace is cut after arrival, the way
// qa/ten-t3b-aaa-rival.mjs does; the seven checks are A4's own, unchanged.
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';
const chapter = process.argv[2] || 'kyoto';
process.env.CAPY_QA_MUTE_AUDIO = '1'; process.env.CAPY_QA_NO_THROTTLE = '1';
const h = await openHarness({ width: 1280, height: 720 });
let checks = 0; const ok = (c, m) => { assert.ok(c, m); checks++; };
const audit = () => h.page.evaluate(() => window.__capy.rivalAudit());
async function waitFruit() {
  for (let i = 0; i < 240; i++) {
    const f = await h.page.evaluate(() => { const g = window.__capy, p = g.capy.position, d = g.dropNearest(p.x, p.z, 26); return d ? Math.hypot(d.x - p.x, d.z - p.z) : -1; });
    if (f >= 5) return f;
    await h.page.waitForTimeout(500);
  }
  return -1;
}
try {
  await h.start(); await h.arrive(chapter); await h.page.bringToFront(); await h.page.waitForTimeout(2500);
  console.log('grace', await h.page.evaluate(() => window.__capy.graceOn()));
  await h.page.evaluate(() => { window.__capy.state.noFirstGrace = true });
  await h.page.evaluate(() => { const g = window.__capy; window.__r = []; for (const n of ['rival:stole', 'rival:dropped', 'rival:escaped']) g.events.on(n, e => window.__r.push(n)); });
  // ---- A
  await h.page.evaluate(() => { const g = window.__capy, p = g.capy.position, y = g.capy.group.rotation.y; g.dropGive(p.x + Math.sin(y) * 10, p.z + Math.cos(y) * 10, 1); });
  let f = await waitFruit(); ok(f >= 5, 'a fruit on the ground to steal');
  await h.page.evaluate(() => window.__capy.rivalSoon());
  let seen = new Set();
  for (let i = 0; i < 90; i++) { const a = await audit(); seen.add(a.state); if (i === 12) await h.screenshot('aaa-rival-' + chapter + '-in'); if (a.state === 'gloat') await h.screenshot('aaa-rival-' + chapter + '-gloat'); if ((await h.page.evaluate(() => window.__r.includes('rival:escaped')))) break; await h.page.waitForTimeout(250); }
  console.log('A states', [...seen].join(' '), JSON.stringify(await h.page.evaluate(() => window.__r)));
  ok(seen.has('in') && seen.has('gloat') && (seen.has('flee') || seen.has('fly')), 'it came in, gloated and fled');
  ok(await h.page.evaluate(() => window.__r.includes('rival:stole') && window.__r.includes('rival:escaped')), 'standing still, it got away');
  // ---- B
  await h.page.waitForTimeout(3000);
  // a fixture fruit eight metres ahead: the drop timer is slow and random,
  // and B is about the chase, not about waiting for the orchard
  await h.page.evaluate(() => { const g = window.__capy, p = g.capy.position, y = g.capy.group.rotation.y; g.dropGive(p.x + Math.sin(y) * 8, p.z + Math.cos(y) * 8, 1); });
  f = await waitFruit(); ok(f >= 5, 'another fruit');
  await h.page.evaluate(() => window.__capy.rivalSoon());
  for (let i = 0; i < 6; i++) { console.log('B audit', f.toFixed(1), JSON.stringify(await audit()), await h.page.evaluate(() => window.__capy.rivalOK())); await h.page.waitForTimeout(400); }
  const held = new Set();
  const keys = async want => { for (const k of [...held]) if (!want.has(k)) { await h.page.keyboard.up(k); held.delete(k); } for (const k of want) if (!held.has(k)) { await h.page.keyboard.down(k); held.add(k); } };
  let dropped = false, wheeked = 0;
  for (let i = 0; i < 160 && !dropped; i++) {
    const s = await h.page.evaluate(() => {
      const g = window.__capy, a = g.rivalAudit(), p = g.capy.body.position;
      if (!a.at) return { state: a.state };
      const dx = a.at[0] - p.x, dz = a.at[2] - p.z, d = Math.hypot(dx, dz);
      const cd = new g.THREE.Vector3(); g.camera.getWorldDirection(cd); cd.y = 0; cd.normalize();
      return { state: a.state, d, f: (dx * cd.x + dz * cd.z) / (d || 1), r: (dx * -cd.z + dz * cd.x) / (d || 1) };
    });
    const want = new Set();
    if (s.d !== undefined && (s.state === 'gloat' || s.state === 'flee' || s.state === 'fly' || s.state === 'in')) {
      if (s.f > 0.2) want.add('KeyW'); else if (s.f < -0.6) want.add('KeyS');
      if (s.r > 0.2) want.add('KeyD'); else if (s.r < -0.2) want.add('KeyA');
      want.add('ShiftLeft');
      if (s.d < 5.5 && s.state !== 'in' && wheeked < 3) { await h.page.keyboard.press('KeyQ'); wheeked++; }
    }
    await keys(want);
    dropped = await h.page.evaluate(() => window.__r.includes('rival:dropped'));
    await h.page.waitForTimeout(120);
  }
  await keys(new Set());
  await h.screenshot('aaa-rival-' + chapter + '-after');
  const back = await h.page.evaluate(() => { const g = window.__capy, p = g.capy.position; return !!g.dropNearest(p.x, p.z, 12); });
  console.log('B', JSON.stringify(await h.page.evaluate(() => window.__r)), 'wheeks', wheeked, 'fruit near', back);
  ok(dropped, 'chased and wheeked, it dropped the fruit');
  ok(back, 'the fruit is back on the ground near you');
  ok(h.metadata.errors.length === 0, 'no errors ' + JSON.stringify(h.metadata.errors.slice(0, 2)));
  console.log('Rival: ' + checks + ' checks pass.');
} finally { await h.close(); }
