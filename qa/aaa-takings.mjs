// AAA A3b: the takings. A chain is built through the real prop:impact path
// (five distinct witnessed bangs at the animal's feet, locals on a 13 m ring
// the way qa/nr-march.js stands them: seen by all, owned by none), then:
//   A. run: the chain closes with you free and the pot is banked;
//   B. again, stand still: somebody reaches you and the pot is gone.
// A task is ticked first only to lift the fresh-file rung lock (90 s).
//   node qa/aaa-takings.mjs [chapter]
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';
const chapter = process.argv[2] || 'kyoto';
process.env.CAPY_QA_MUTE_AUDIO = '1'; process.env.CAPY_QA_NO_THROTTLE = '1';
const h = await openHarness({ width: 1280, height: 720 });
let checks = 0; const ok = (c, m) => { assert.ok(c, m); checks++; };
// the wallet counts UP over ~0.36 s (yuzuCountTo): read it settled
const wallet = async () => { await h.page.waitForTimeout(1500); return walletNow(); };
const walletNow = () => h.page.evaluate(() => { const w = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && /^\d+ yuzu$/.test(e.textContent.trim())); return w ? parseInt(w.textContent, 10) : null; });
const pips = () => h.page.evaluate(() => { const e = document.querySelector('.capyui-pips'); return e ? e.textContent.trim() : ''; });
async function ring() {
  await h.page.evaluate(() => {
    const g = window.__capy, p = g.capy.position, live = g.biome.current;
    const L = (g.locals || []).filter(r => r.biome === live && r.group);
    L.forEach((r, k) => {
      const a = k / Math.max(1, L.length) * 6.283185;
      r.x = p.x + Math.sin(a) * 13; r.z = p.z + Math.cos(a) * 13;
      r.ax = r.x; r.az = r.z; r.tx = r.x; r.tz = r.z; r.marCool = 0;
      r.group.position.set(r.x, r.group.position.y, r.z);
      if (r.body) { r.body.position.x = r.x; r.body.position.z = r.z; r.body.aabbNeedsUpdate = true; }
    });
  });
  await h.page.waitForTimeout(500);
}
async function bangs(tag) {
  for (let i = 0; i < 5; i++) {
    await h.page.evaluate(([i, tag]) => {
      const g = window.__capy, p = g.capy.position;
      g.events.emit('prop:impact', { prop: { type: 'crate', id: tag + i, disturbed: true, lastCapyTouch: g.state.time },
        speed: 7, position: { x: p.x + 0.8, y: p.y, z: p.z + 0.6 } });
    }, [i, tag]);
    await h.page.waitForTimeout(350);
  }
}
try {
  await h.start(); await h.arrive(chapter); await h.page.bringToFront(); await h.page.waitForTimeout(2500);
  await h.page.evaluate(() => window.__capy.completeTask('bin-chicken', true));   // any tick lifts the lock
  await h.page.evaluate(() => { window.__t = []; new MutationObserver(ms => { for (const m of ms) for (const nd of m.addedNodes) { const t = (nd.textContent || '').trim(); if (t && t.length < 140) window.__t.push(t); } }).observe(document.body, { childList: true, subtree: true }); });
  // ---- A: run
  await ring();
  const w0 = await wallet();
  await bangs('a');
  await h.page.waitForTimeout(400);
  const lab = await pips(); console.log('row', lab);
  ok(/yuzu on it/.test(lab), 'the row says what is riding on the chain');
  await h.page.keyboard.down('ShiftLeft');
  for (const k of ['KeyW', 'KeyD', 'KeyW', 'KeyA', 'KeyW']) await h.hold(k, 2000);
  await h.page.keyboard.up('ShiftLeft');
  let banked = false;
  for (let i = 0; i < 120 && !banked; i++) { await h.page.waitForTimeout(250); banked = await h.page.evaluate(() => window.__t.some(t => /got away with it/.test(t))); }
  const w1 = await wallet();
  console.log('A wallet', w0, '->', w1, JSON.stringify(await h.page.evaluate(() => window.__t.filter(t => /yuzu|got away|reached|picked/.test(t)).slice(-4))));
  ok(banked && w1 >= w0 + 3, 'running, the takings were banked');
  // ---- B: stand still — after the card cooldown (sysINC_COOL, 50 s): the
  // pot follows the cards, and a carded chain holds the next card off
  await h.page.waitForTimeout(53000);
  await ring();
  await bangs('b');
  let lost = false;
  for (let i = 0; i < 160 && !lost; i++) { await h.page.waitForTimeout(250); lost = await h.page.evaluate(() => window.__t.some(t => /takings are gone/.test(t))); }
  const w2 = await wallet();
  console.log('B wallet', w1, '->', w2, JSON.stringify(await h.page.evaluate(() => window.__t.filter(t => /yuzu|got away|reached|picked/.test(t)).slice(-3))));
  ok(lost, 'standing still, the takings were lost');
  ok(w2 <= w1, 'and nothing was paid');
  ok(h.metadata.errors.length === 0, 'no errors ' + JSON.stringify(h.metadata.errors.slice(0, 2)));
  console.log('Takings: ' + checks + ' checks pass.');
} finally { await h.close(); }
