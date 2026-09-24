// ROADMAP-TEN T1a: the picker in both modes, at three windows, as pictures
// to read by eye and as numbers the eye cannot be trusted with.
//   free   a fresh profile, the Free roam door: the flat shelf
//   atlas  a story file, pause's "choose a place": the act atlas
// For each: tiles wholly inside the window AND inside the shelf's own box,
// whether the "more below" pill is up, any clipped name or hint, and the
// row tops (an uneven row is two tops on one row).
//   CAPY_QA_URL=http://localhost:5191/ node qa/ten-t1a-shots.mjs [tag]
import { openTitle } from './ten-t1a-open.mjs';

const tag = process.argv[2] || 'now';
const url = process.env.CAPY_QA_URL || 'http://localhost:5188/';
process.env.CAPY_QA_MUTE_AUDIO = '1'; process.env.CAPY_QA_NO_THROTTLE = '1';
const SIZES = [[1280, 720], [1440, 900], [390, 844]];
const h = await openTitle({ url, width: 1280, height: 720 });
const page = h.page;
page.setDefaultNavigationTimeout(150000); page.setDefaultTimeout(90000);
const title = () => page.waitForFunction(() => window.__capy && document.querySelector('.capyui-go, .capyui-carry'), null, { timeout: 60000 });
const measure = () => page.evaluate(() => {
  const vw = innerWidth, vh = innerHeight;
  const shelf = [...document.querySelectorAll('.capyui-picks')].find(p => p.offsetParent !== null);
  const sr = shelf ? shelf.getBoundingClientRect() : { top: 0, bottom: vh };
  const picks = [...document.querySelectorAll('.capyui-p2 .capyui-pick')].filter(p => p.offsetParent !== null);
  const inView = picks.filter(p => { const r = p.getBoundingClientRect();
    const inShelf = p.classList.contains('hero') || (r.top >= sr.top - 2 && r.bottom <= sr.bottom + 2);
    return r.top >= -1 && r.bottom <= vh + 1 && r.left >= -1 && r.right <= vw + 1 && inShelf; });
  const clipped = [];
  for (const p of picks) for (const el of p.querySelectorAll('.capyui-pickbody b,.capyui-pickbody i,.capyui-pickbody em')) {
    if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).textOverflow !== 'ellipsis' && getComputedStyle(el).webkitLineClamp === 'none') clipped.push(el.textContent.slice(0, 30));
    if (el.scrollHeight > el.clientHeight + 2) clipped.push('v:' + el.textContent.slice(0, 30));
  }
  const tops = {};
  for (const p of picks) if (!p.classList.contains('hero')) { const t = Math.round(p.getBoundingClientRect().top); tops[t] = (tops[t] || 0) + 1; }
  const heights = [...new Set(picks.filter(p => !p.classList.contains('hero')).map(p => Math.round(p.getBoundingClientRect().height)))];
  const more = document.querySelector('.capyui-more2');
  const card = document.querySelector('.capyui-card').getBoundingClientRect();
  return { vw, vh, picks: picks.length, inView: inView.length, locked: picks.filter(p => p.disabled).length,
    more: more && !more.hidden ? more.textContent.trim() : '', clipped, rows: tops, heights,
    heading: (document.querySelector('.capyui-h2') || {}).textContent,
    stat: (document.querySelector('.capyui-p2stat') || {}).textContent,
    cardBottom: Math.round(card.bottom), docScroll: document.documentElement.scrollHeight > vh + 1,
    titleScroll: (() => { const t = document.querySelector('.capyui-title'); return t.scrollHeight > t.clientHeight + 1; })(),
    hScroll: document.documentElement.scrollWidth > vw + 1,
    flat: !!(shelf && shelf.classList.contains('flat')), folds: document.querySelectorAll('.capyui-p2 .capyui-act').length };
});
const out = {};
try {
  await title();
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload(); await title(); await page.waitForTimeout(900);
  for (const [w, hgt] of SIZES) {
    await page.setViewportSize({ width: w, height: hgt });
    await page.waitForTimeout(400);
    if (w === SIZES[0][0] && hgt === SIZES[0][1]) {
      out.p1 = await page.evaluate(() => [...document.querySelectorAll('.capyui-p1 button')].map(b => b.textContent.trim()));
      await page.screenshot({ path: 'qa/ten-t1a-p1-fresh-' + tag + '.png' });
    }
    await page.evaluate(() => { const b = document.querySelector('.capyui-go[data-free]') || document.querySelector('.capyui-go.alt'); b.click(); });
    await page.waitForTimeout(3000);   // the deal-in animation settles
    out['free-' + w] = await measure();
    await page.screenshot({ path: 'qa/ten-t1a-p2-free-' + w + '-' + tag + '.png' });
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  }
  // a story file: Begin, a few seconds, flush, then pause's door to the atlas
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => [...document.querySelectorAll('.capyui-go')].find(x => !x.classList.contains('alt')).click());
  await page.waitForFunction(() => window.__capy.state.started === true, null, { timeout: 60000 });
  await page.waitForTimeout(4000);
  await page.evaluate(() => { try { window.__capy.saveFlush && window.__capy.saveFlush(); } catch (e) {} });
  await page.waitForTimeout(1500);
  for (const [w, hgt] of SIZES) {
    await page.setViewportSize({ width: w, height: hgt });
    await page.evaluate(() => sessionStorage.setItem('capy3.pick', '1'));
    await page.reload(); await title(); await page.waitForTimeout(3500);
    out['atlas-' + w] = await measure();
    await page.screenshot({ path: 'qa/ten-t1a-p2-atlas-' + w + '-' + tag + '.png' });
    if (w === 1280) {
      await page.keyboard.press('Escape'); await page.waitForTimeout(500);
      out.p1story = await page.evaluate(() => [...document.querySelectorAll('.capyui-p1 button')].map(b => b.textContent.trim()));
      await page.screenshot({ path: 'qa/ten-t1a-p1-story-' + tag + '.png' });
    }
  }
  out.errors = h.errors.slice(0, 4);
  for (const k in out) console.log(k, JSON.stringify(out[k]));
} finally { await h.close(); }
