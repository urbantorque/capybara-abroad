async page => {
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://localhost:5188/');
  await page.waitForTimeout(6000);
  await page.evaluate(() => document.querySelector('.capyui-go').click());
  await page.waitForTimeout(2500);
  // walk near shop if possible, else just hover the map to show the legend
  await page.evaluate(() => {
    const el = document.querySelector('.capyui-map');
    if (el) { const r = el.getBoundingClientRect(); el.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 })); }
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'qa/l10-map-legend.png' });
  const legendText = await page.evaluate(() => Array.from(document.querySelectorAll('.capyui-mlrow span')).map(s => s.textContent));
  await page.evaluate(async (o) => { await fetch('/shot?name=l10-map-legend.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, legendText);
}
