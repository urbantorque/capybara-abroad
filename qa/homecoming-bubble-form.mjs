// Organic narrow-screen dialogue layout. Random speech makes this a bounded
// observation, not a guaranteed count or a test of line authoring.
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';

const desktop = process.argv.includes('--desktop');
const name = desktop ? 'homecoming-bubble-form-desktop-v1' : 'homecoming-bubble-form-phone-v1';
const h = await openHarness(desktop
  ? { width: 1280, height: 760 }
  : { width: 390, height: 844, hasTouch: true, isMobile: true });
const out = { metadata: h.metadata, samples: 0, visible: 0, wrapped: 0,
  outside: [], mapOverlaps: [], examples: [] };
try {
  await h.start();
  await h.hold('KeyW', 3000);
  const end = Date.now() + 30000;
  let photographed = false;
  while (Date.now() < end) {
    const rows = await h.page.evaluate(() => {
      const map = document.querySelector('.capyui-map')?.getBoundingClientRect();
      const viewportWidth = innerWidth;
      return [...document.querySelectorAll('.capynpc-bubble')].flatMap(el => {
        const css = getComputedStyle(el);
        if (css.display === 'none' || +css.opacity < .2) return [];
        const r = el.getBoundingClientRect();
        const overlap = map ? Math.max(0, Math.min(r.right, map.right) - Math.max(r.left, map.left)) *
          Math.max(0, Math.min(r.bottom, map.bottom) - Math.max(r.top, map.top)) : 0;
        return [{ text: el.textContent.trim(), width: r.width, height: r.height,
          left: r.left, right: r.right, viewportWidth, overlap: Math.round(overlap),
          anchor: el.style.left, scale: el.style.transform, intrinsic: el.offsetWidth }];
      });
    });
    out.samples++;
    for (const row of rows) {
      out.visible++;
      if (row.height > 44 && row.text.length > 35) {
        out.wrapped++;
        if (!photographed) { await h.screenshot(name); photographed = true; }
      }
      if (row.left < -2 || row.right > row.viewportWidth + 2) out.outside.push(row);
      if (row.overlap > 0) out.mapOverlaps.push(row);
      if (out.examples.length < 15 && !out.examples.some(x => x.text === row.text)) out.examples.push(row);
    }
    await h.page.waitForTimeout(200);
  }
  out.widthFixture = await h.page.evaluate(() => {
    const el = document.querySelector('.capynpc-bubble');
    const span = el?.querySelector('span');
    if (!el || !span) return null;
    const css = el.style.cssText, words = span.textContent;
    el.style.display = 'block'; el.style.visibility = 'hidden';
    span.textContent = 'The road bends beyond the harbour, and the traveller wonders what waits on the other side.';
    el.style.left = '5%';
    const near = { width: el.offsetWidth, height: el.offsetHeight };
    el.style.left = '90%';
    const far = { width: el.offsetWidth, height: el.offsetHeight };
    span.textContent = words; el.style.cssText = css;
    return { near, far };
  });
  assert(out.samples > 50 && out.visible > 0, 'observed live speech');
  assert.equal(out.outside.length, 0, 'all observed speech stays on screen');
  assert(out.widthFixture?.near.height > 44, 'long line wraps into a short note');
  assert.deepEqual(out.widthFixture.near, out.widthFixture.far,
    'note dimensions do not depend on its previous left position');
  assert.equal(h.metadata.errors.length, 0, 'no runtime error');
  out.pass = true;
} catch (error) { out.pass = false; out.failure = String(error.stack || error); process.exitCode = 1; }
finally {
  await h.result(name, out);
  await h.close();
  console.log(JSON.stringify({ pass: out.pass, samples: out.samples, visible: out.visible,
    wrapped: out.wrapped, outside: out.outside.length, mapOverlaps: out.mapOverlaps.length,
    failure: out.failure }));
}
