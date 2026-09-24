// ROADMAP-TEN T3a: a quick look at the paper's state on a fresh free file.
//   CAPY_QA_URL=http://localhost:5191/ node qa/ten-t3a-probe.mjs
import { openTitle } from './ten-t1a-open.mjs';
const h = await openTitle({ url: process.env.CAPY_QA_URL, width: 1280, height: 720 });
const page = h.page;
try {
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.__capy && document.querySelector('.capyui-go'));
  await page.waitForTimeout(900);
  await page.evaluate(() => { const b = document.querySelector('.capyui-go[data-free]') || document.querySelector('.capyui-go.alt'); b.click(); });
  await page.waitForTimeout(2500);
  await page.evaluate(() => document.querySelector('.capyui-pick.hero').click());
  await page.waitForFunction(() => window.__capy.state.started === true);
  for (const t of [3000, 6000, 12000]) {
    await page.waitForTimeout(t);
    console.log(JSON.stringify(await page.evaluate(() => {
      const el = document.querySelector('.capyui-todo'), r = el.getBoundingClientRect();
      return { cls: el.className, op: getComputedStyle(el).opacity, disp: getComputedStyle(el).display,
        vis: getComputedStyle(el).visibility, r: [r.x, r.y, r.width, r.height].map(Math.round),
        hud: document.getElementById('hud') && document.getElementById('hud').className,
        tut: window.__capy.state.tutBeat, sk: getComputedStyle(document.querySelector('.capyui-sketch')).display };
    })));
  }
  await page.screenshot({ path: 'qa/ten-t3a-probe.png' });
  console.log('errors', JSON.stringify(h.errors.slice(0, 4)));
} finally { await h.close(); }
