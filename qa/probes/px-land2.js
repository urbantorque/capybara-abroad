async page => {
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4300);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(5500);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(900);
  const out = await page.evaluate(() => {
    document.querySelector('.capyui-touch').classList.add('on');
    const res = [];
    for (const e of document.querySelectorAll('#hud *')) {
      const b = e.getBoundingClientRect();
      if (b.width < 6 || b.height < 6) continue;
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.02) continue;
      if (b.right < innerWidth * 0.62) continue;
      if (e.parentElement && e.parentElement.closest('#hud') &&
          [...e.parentElement.children].length === 1 && e.tagName !== 'DIV') continue;
      res.push({ cls: (e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className) || e.tagName,
                 t: Math.round(b.top), b: Math.round(b.bottom),
                 l: Math.round(b.left), r: Math.round(b.right) });
    }
    return { vh: innerHeight, vw: innerWidth, els: res.slice(0, 40) };
  });
  await page.screenshot({ path: 'qa/px-land-844x390.png' });
  await page.evaluate(o => fetch('/shot?name=px-land2.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
