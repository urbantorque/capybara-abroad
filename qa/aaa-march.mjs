// AAA A3: the march, its mark, its cost and its escape — in a live chapter.
// A chain event at go-rung is emitted at the animal (the same event systems.js
// emits at the fourth witnessed thing), then:
//   1. stand still: somebody must set off, wear the take, and reach you; the
//      wallet must drop and the toast must say who and what;
//   2. again, and run (real keys): they must give up, and the wallet rise.
//   node qa/aaa-march.mjs [chapter]
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';

const chapter = process.argv[2] || 'kyoto';
process.env.CAPY_QA_MUTE_AUDIO = '1'; process.env.CAPY_QA_NO_THROTTLE = '1';
const h = await openHarness({ width: 1280, height: 720 });
let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const wallet = () => h.page.evaluate(() => { const w = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && /^\d+ yuzu$/.test(e.textContent.trim())); return w ? parseInt(w.textContent, 10) : null; });
try {
  await h.start(); await h.arrive(chapter); await h.page.bringToFront(); await h.page.waitForTimeout(3000);
  await h.page.evaluate(() => {
    const g = window.__capy; window.__m = { toasts: [], ev: [] };
    for (const n of ['npc:march', 'npc:caught', 'npc:gaveup', 'npc:lost']) g.events.on(n, e => window.__m.ev.push([n, +g.state.time.toFixed(1), JSON.stringify((e && e.npc) || e).slice(0, 80)]));
    new MutationObserver(ms => { for (const m of ms) for (const nd of m.addedNodes) { const t = (nd.textContent || '').trim(); if (t && t.length < 120) window.__m.toasts.push(t); } }).observe(document.body, { childList: true, subtree: true, characterData: false });
  });
  // ---- 1. caught
  const w0 = await wallet();
  const go = () => h.page.evaluate(() => { const g = window.__capy, p = g.capy.position; g.events.emit('capy:chain', { x: p.x, z: p.z, n: 5 }); return !!g.marcher(); });
  let marching = await go();
  for (let i = 0; i < 20 && !marching; i++) { await h.page.waitForTimeout(250); marching = await h.page.evaluate(() => !!window.__capy.marcher()); }
  ok(marching, 'somebody set off');
  await h.page.waitForTimeout(1200);
  const mark = await h.page.evaluate(() => { let v = false; window.__capy.scene.traverse(o => { if (o.isInstancedMesh && o.count === 12 && o.visible) v = true; }); return v; });
  ok(mark, 'the marcher wears the take');
  await h.screenshot('aaa-march-' + chapter + '-coming');
  let caught = false;
  for (let i = 0; i < 120 && !caught; i++) { await h.page.waitForTimeout(250); caught = await h.page.evaluate(() => window.__m.ev.some(e => e[0] === 'npc:caught')); }
  ok(caught, 'standing still, they reached you');
  await h.page.waitForTimeout(1500);
  const w1 = await wallet();
  console.log('wallet', w0, '->', w1);
  if (w0 > 0) ok(w1 < w0, 'the catch cost yuzu');
  // ---- 2. escape
  await h.page.waitForTimeout(20000);     // npcMAR_COOL is 18 s: the same person may go again
  marching = await go();
  for (let i = 0; i < 40 && !marching; i++) { await h.page.waitForTimeout(250); marching = await h.page.evaluate(() => !!window.__capy.marcher()); }
  let escaped = false;
  if (marching) {
    await h.page.keyboard.down('ShiftLeft');
    for (const k of ['KeyW', 'KeyD', 'KeyW', 'KeyA', 'KeyW', 'KeyS']) { await h.hold(k, 2200); }
    await h.page.keyboard.up('ShiftLeft');
    for (let i = 0; i < 100 && !escaped; i++) { await h.page.waitForTimeout(250); escaped = await h.page.evaluate(() => window.__m.ev.some(e => e[0] === 'npc:gaveup' || e[0] === 'npc:lost')); }
    console.log('march why', JSON.stringify(await h.page.evaluate(() => { const a = window.__capy.marchAudit(); return { why: a.why, d: a.d, t: a.t, blocked: a.blocked }; })));
  }
  const w2 = await wallet();
  const m = await h.page.evaluate(() => window.__m);
  console.log(JSON.stringify({ w0, w1, w2, ev: m.ev, toasts: m.toasts.filter(t => /yuzu|got away|lost them|picked up|reached/.test(t)).slice(0, 8) }));
  if (!marching) console.log('second march refused:', JSON.stringify(await h.page.evaluate(() => { const a = window.__capy.marchAudit(); return { why: a.why }; })));
  ok(marching, 'a second march');
  ok(escaped, 'running, they gave up or lost you');
  ok(w2 > w1, 'the escape paid');
  ok(h.metadata.errors.length === 0, 'no page errors ' + JSON.stringify(h.metadata.errors.slice(0, 2)));
  console.log('March: ' + checks + ' checks pass.');
} finally { await h.close(); }
