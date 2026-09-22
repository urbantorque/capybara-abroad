// UI-state probe for the full todo sheet's timed tuck. This records rendered
// state after real arrivals and movement; it does not claim human preference.
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';

const phone = process.env.CAPY_QA_PHONE === '1';
const h = await openHarness(phone ? { width: 390, height: 844, hasTouch: true, isMobile: true } : {});
const out = { metadata: h.metadata, fixture: phone ? 'touch-sized Sydney; tab tap' :
  'Free Roam; sequential Sydney and Hanoi arrivals; real KeyW hold', chapters: [], checks: 0 };
function check(ok, label) { assert(ok, label); out.checks++; }
async function waitForAway(page, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await page.locator('.capyui-todo').evaluate(el => el.classList.contains('away'))) return true;
    await page.waitForTimeout(500);
  }
  return false;
}
async function paper(page) {
  return page.locator('.capyui-todo').evaluate(el => ({
    away: el.classList.contains('away'), rect: el.getBoundingClientRect().toJSON(),
    tabDisplay: getComputedStyle(el.querySelector('.capyui-tab')).display,
    tabRect: el.querySelector('.capyui-tab').getBoundingClientRect().toJSON(),
    tabText: el.querySelector('.capyui-txt').textContent,
    hidden: document.hidden, focused: document.hasFocus(), chapter: window.__capy.biome.current,
    started: window.__capy.state.started, paused: window.__capy.state.paused,
    rung: window.__capy.state.perfRung, lastError: window.__capy.state.lastError || null
  }));
}
try {
  await h.start();
  check(await h.page.evaluate(() => window.__capy.state.started), 'Free Roam started');
  for (const chapter of phone ? ['sydney'] : ['sydney', 'hanoi']) {
    await h.arrive(chapter);
    check(await waitForAway(h.page, 22000), `${chapter}: arrival sheet eventually tucks`);
    const preMove = await paper(h.page);
    await h.hold('KeyW', 3000);
    const movementEnd = await paper(h.page);
    check(movementEnd.away, `${chapter}: movement does not reopen tucked sheet`);
    // A newly earned task may deliberately reveal the sheet during this walk.
    // Wait for the authored hold to finish before measuring the final size.
    const tuckedAfterMove = await waitForAway(h.page, 20000);
    const compact = await paper(h.page);
    check(tuckedAfterMove && compact.away, `${chapter}: paper tucks after arrival and movement idle`);
    check(!!compact.tabText && !compact.tabText.includes('the big experience or the quieter route'), `${chapter}: compact tab leads with a concrete task`);
    if (phone) check(compact.tabRect.height >= 44, `${chapter}: touch tab is at least 44 px tall`);
    await h.screenshot(`homecoming-hud-breath-${chapter}-${phone ? 'phone-' : ''}compact`);

    await h.page.locator('.capyui-todo .capyui-tab').click();
    await h.page.waitForFunction(() => {
      const el = document.querySelector('.capyui-todo');
      return el && !el.classList.contains('away');
    });
    const expanded = await paper(h.page);
    check(!expanded.away && expanded.rect.height > compact.rect.height, `${chapter}: tab restores full paper`);
    await h.screenshot(`homecoming-hud-breath-${chapter}-${phone ? 'phone-' : ''}expanded`);

    const tuckedAgain = await waitForAway(h.page, 16000);
    const final = await paper(h.page);
    check(tuckedAgain && final.away, `${chapter}: paper tucks again within 16 seconds`);
    check(final.chapter === chapter && final.started && final.focused && !final.hidden, `${chapter}: visible live scene`);
    out.chapters.push({ chapter, preMove, movementEnd, compact, expanded, final });
  }
  check(h.metadata.errors.length === 0, 'no browser runtime errors');
  out.pass = true;
} catch (e) {
  out.pass = false; out.failure = String(e.stack || e); process.exitCode = 1;
} finally {
  await h.result(`homecoming-hud-breath-${phone ? 'phone' : 'desktop'}-v1`, out);
  await h.close();
  console.log(JSON.stringify({ pass: out.pass, checks: out.checks, failure: out.failure }));
}
