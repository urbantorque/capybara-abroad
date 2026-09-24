// ROADMAP-TEN T3a: the sketchbook, driven. A fresh profile takes the Free
// roam door and the Sydney tile; the paper must be the place's page (no tick
// boxes, three silhouettes with a want each, the names tally), a name earned
// through the real chain (three spills in front of somebody) must be stamped
// at rank 2 and change the page, and a reload must carry the name to the free
// wall's stat and the Sydney tile's word. Kyoto and Hanoi are entered for
// their pages. Screenshots are for reading by eye.
//   CAPY_QA_URL=http://localhost:5191/ node qa/ten-t3a-free.mjs [tag]
import { openTitle } from './ten-t1a-open.mjs';

const tag = process.argv[2] || 'now';
const url = process.env.CAPY_QA_URL || 'http://localhost:5188/';
const h = await openTitle({ url, width: 1280, height: 720 });
const page = h.page;
const out = { checks: [] };
const ok = (name, pass, got) => out.checks.push({ name, pass: !!pass, got });
const title = () => page.waitForFunction(() => window.__capy && document.querySelector('.capyui-go, .capyui-carry'), null, { timeout: 90000 });
const paper = () => page.evaluate(() => window.__capy.state.qaFreePaper());
const freeDoor = () => page.evaluate(() => { const b = document.querySelector('.capyui-go[data-free]') || document.querySelector('.capyui-go.alt'); b.click(); });
const wall = () => page.evaluate(() => ({
  stat: (document.querySelector('.capyui-p2stat') || {}).textContent || '',
  syd: (() => { const t = document.querySelector('.capyui-picks.flat .capyui-pick[data-n="1"], .capyui-pick.hero[data-n="1"]');
    return t ? { chip: (t.querySelector('.capyui-picktally') || {}).textContent || '', rec: (t.querySelector('.capyui-pickrec') || {}).textContent || '' } : null; })(),
  kyo: (() => { const t = document.querySelector('.capyui-picks.flat .capyui-pick[data-n="4"]');
    return t ? (t.querySelector('.capyui-picktally') || {}).textContent || '' : null; })(),
  tiles: [...document.querySelectorAll('.capyui-p2 .capyui-pick')].filter(p => p.offsetParent !== null).length,
  heights: [...new Set([...document.querySelectorAll('.capyui-picks.flat .capyui-pick')].filter(p => p.offsetParent !== null).map(p => Math.round(p.getBoundingClientRect().height)))],
  more: (() => { const m = document.querySelector('.capyui-more2'); return m && !m.hidden && m.offsetParent !== null ? m.textContent.trim() : ''; })(),
}));
// the paper tucks eight seconds after arrival; L brings the sheet back
async function openPaper() {
  // the opening keeps the HUD quiet for its first seconds; wait it out
  await page.waitForFunction(() => !document.getElementById('hud').classList.contains('opening-quiet'), null, { timeout: 60000 }).catch(() => {});
  if (await page.evaluate(() => document.querySelector('.capyui-todo').classList.contains('away'))) {
    await page.keyboard.press('KeyL'); await page.waitForTimeout(900);
  }
}
async function cross(name) {
  await page.evaluate(n => window.__capy.hud.cross(n), name);
  await page.waitForFunction(n => window.__capy.biome.current === n, name, { timeout: 90000 });
  await page.waitForTimeout(9000);
  await openPaper();
}
try {
  await title();
  await page.evaluate(() => localStorage.clear());
  await page.reload(); await title(); await page.waitForTimeout(900);
  await freeDoor(); await page.waitForTimeout(2500);
  await page.evaluate(() => document.querySelector('.capyui-pick.hero').click());
  await page.waitForFunction(() => window.__capy.state.started === true, null, { timeout: 90000 });
  await page.waitForTimeout(9000);
  await openPaper();
  const s0 = await paper();
  out.sydney = s0;
  ok('mode is free', await page.evaluate(() => window.__capy.state.journeyMode === 'free'), null);
  ok('paper is the sketchbook', s0.on && /sketchbook/i.test(s0.kick), s0.kick);
  ok('no tick boxes on the free paper', s0.boxes === 0, s0.boxes);
  ok('three silhouettes, each with a want', s0.rows.filter(r => r && r.want && r.bars > 0).length === 3, s0.rows);
  ok('place line names Sydney', /Sydney/.test(s0.place) && s0.line.length > 5, s0.place + ' / ' + s0.line);
  ok('no memory line on the free paper', !/memor/i.test(s0.count + s0.foot + s0.soft), s0.count);
  ok('tally counts names', /of \d+ names/.test(s0.foot), s0.foot);
  await page.screenshot({ path: 'qa/ten-t3a-sydney-' + tag + '.png' });
  // a name, through the real chain: a tick lifts the first-minute gate, then
  // three spills in front of the nearest person
  const before = await page.evaluate(() => window.__capy.repDebug().found);
  await page.evaluate(() => {
    const g = window.__capy;

    g.completeTask('steal-hat');
  });
  await page.waitForTimeout(1500);
  const fired = await page.evaluate(() => {
    const g = window.__capy, c = g.capy.position;
    let best = null, bd = 1e9;
    for (const r of g.npcs || []) { if (!r || !r.group || r.group.visible === false) continue;
      const p = r.group.position, d = Math.hypot(p.x - c.x, p.z - c.z); if (d < bd) { bd = d; best = p; } }
    if (!best) return { err: 'nobody' };
    for (let i = 0; i < 3; i++) g.events.emit('prop:impact', { spill: true, speed: 0,
      position: { x: best.x + 1, y: best.y, z: best.z + 1 }, prop: { disturbed: true, type: 'hat', id: 'qa-t3a-' + i } });
    return { d: bd };
  });
  out.fired = fired;
  await page.waitForTimeout(1200);
  const mom = await page.evaluate(() => window.__capy.state.qaMoments());
  const stampEl = await page.evaluate(() => { const m = document.querySelector('.capyui-moment'); return { stamp: m.classList.contains('stamp'), show: m.classList.contains('show'), text: m.textContent }; });
  await page.screenshot({ path: 'qa/ten-t3a-stamp-' + tag + '.png' });
  const after = await page.evaluate(() => window.__capy.repDebug().found);
  const last = mom.shown[mom.shown.length - 1] || {};
  out.moment = { last, stampEl, before, after };
  ok('a name was earned', after === before + 1, before + ' -> ' + after);
  ok('the stamp card is rank 2 and stamped', last.pri === 2 && last.cls === 'stamp' && stampEl.stamp, last);
  const s1 = await paper();
  out.sydneyAfter = s1;
  ok('the page moved on: the earned name is not a silhouette', JSON.stringify(s1.rows) !== JSON.stringify(s0.rows) || s1.foot !== s0.foot, s1.foot);
  await page.waitForTimeout(4000);
  await page.evaluate(() => { try { window.__capy.saveFlush && window.__capy.saveFlush(); } catch (e) {} });
  await page.waitForTimeout(1500);
  for (const n of ['kyoto', 'hanoi']) {
    await cross(n);
    const s = await paper();
    out[n] = s;
    ok(n + ' page: three silhouettes', s.rows.filter(r => r && r.bars > 0).length === 3, s.rows.map(r => r && r.id));
    await page.screenshot({ path: 'qa/ten-t3a-' + n + '-' + tag + '.png' });
  }
  await page.evaluate(() => { try { window.__capy.saveFlush && window.__capy.saveFlush(); } catch (e) {} });
  await page.waitForTimeout(1500);
  // the free wall after a reload: the stat reads the rank and the names
  await page.reload(); await title(); await page.waitForTimeout(900);
  await freeDoor(); await page.waitForTimeout(3000);
  const w = await wall();
  out.wall = w;
  ok('p2stat reads names', /\d+ of \d+ names/.test(w.stat) && /1 of/.test(w.stat), w.stat);
  ok('19 tiles in view, no pill', w.tiles === 19 && !w.more, w.tiles + ' ' + w.more);
  ok('one tile height', w.heights.length === 1, w.heights);
  ok('Sydney tile has its word and a secrets line', w.syd && /secret/.test(w.syd.rec) && /rumour/.test(w.syd.chip), w.syd);
  ok('Kyoto tile has a noticed chip on its picture', /noticed/.test(w.kyo || ''), w.kyo);
  await page.screenshot({ path: 'qa/ten-t3a-wall-' + tag + '.png' });
  out.errors = h.errors.slice(0, 6);
  ok('no runtime errors', !h.errors.length, h.errors.slice(0, 3));
} catch (e) { out.fatal = String(e.stack || e).slice(0, 600); }
finally {
  const pass = out.checks.filter(c => c.pass).length;
  console.log(JSON.stringify(out, null, 1));
  console.log('T3a free: ' + pass + '/' + out.checks.length);
  await h.close();
}
