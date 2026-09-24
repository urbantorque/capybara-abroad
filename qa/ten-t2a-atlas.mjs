// ROADMAP-TEN T2a: the story atlas at 1280x720 has no scrollbar anywhere.
// A fresh story file (Begin, then pause's "choose a place"), measured for
// every element that can scroll and is wider than half the window.
//   CAPY_QA_URL=http://localhost:5191/ node qa/ten-t2a-atlas.mjs
import assert from 'node:assert/strict';
import { openTitle } from './ten-t1a-open.mjs';
const h = await openTitle({ width: 1280, height: 720 });
const p = h.page;
let out = {};
try {
  await p.evaluate(() => [...document.querySelectorAll('.capyui-go')].find(b => !b.classList.contains('alt')).click());
  await p.waitForFunction(() => window.__capy.state.started === true);
  await p.waitForTimeout(3000);
  await p.evaluate(() => { try { window.__capy.saveFlush && window.__capy.saveFlush(); } catch (e) {} });
  await p.waitForFunction(() => !!localStorage.getItem('capy3.journey.v1'));
  await p.evaluate(() => sessionStorage.setItem('capy3.pick', '1'));
  await p.reload({ waitUntil: 'load' });
  await p.waitForFunction(() => !!window.__capy && !!document.querySelector('.capyui-carry'));
  await p.locator('.capyui-card.two').waitFor();
  await p.waitForTimeout(1500);
  out = await p.evaluate(() => {
    const rows = [];
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      if (!/(auto|scroll)/.test(cs.overflowY) && el !== document.scrollingElement) continue;
      const r = el.getBoundingClientRect();
      if (r.width < innerWidth / 2) continue;
      if (el.scrollHeight > el.clientHeight) rows.push({ cls: el.className || el.tagName, sh: el.scrollHeight, ch: el.clientHeight, oy: cs.overflowY });
    }
    const t = document.querySelector('.capyui-title'), c = document.querySelector('.capyui-card.two');
    const cs = getComputedStyle(t), cc = getComputedStyle(c);
    const geo = { tPad: cs.paddingTop + ' ' + cs.paddingBottom, tDisp: cs.display + ' ' + cs.alignItems, cTop: c.getBoundingClientRect().top, cH: c.getBoundingClientRect().height, cMargin: cc.marginTop + ' ' + cc.marginBottom, cMax: cc.maxHeight, kids: [...c.children].map(k => k.className + ':' + Math.round(k.getBoundingClientRect().height)) };
    return { geo, rows: rows.filter(r => !/picks more|jrcard/.test(r.cls)), stat: (document.querySelector('.capyui-p2stat') || {}).innerText || '' };
  });
  await p.screenshot({ path: 'qa/ten-t2a-atlas-fresh.png' });
  console.log(JSON.stringify(out, null, 1));
  assert.equal(out.rows.length, 0, 'nothing wider than half the window scrolls');
  assert.equal(h.errors.length, 0, 'no runtime errors');
  console.log('atlas: no page scroll');
} catch (e) {
  console.log('FAIL ' + String(e.message).slice(0, 200), JSON.stringify(h.errors));
  process.exitCode = 1;
} finally { await h.close(); }
