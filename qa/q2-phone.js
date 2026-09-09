async page => {
  // THE PHONE, which is the width that decides this page: 360 px, the card at
  // 338, and forty cells in it. See qa/q2-page.js for the numbers.
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(6000);
  await page.evaluate(() => window.__capy.hud.forceRep({
    'same-again': 3, 'hat-trick': 1, 'bin-day': 2, 'flat-white': 1,
    'smash-grab': 1, 'deep-six': 1, 'gondoliers-farewell': 1 }));
  await page.setViewportSize({ width: 360, height: 740 });
  await page.waitForTimeout(500);
  await page.keyboard.press('KeyJ');
  await page.waitForTimeout(900);
  const geom = await page.evaluate(() => {
    const d = document.querySelector('.capyui-jrrep');
    d.open = true;
    const c = document.querySelector('.capyui-jrcard');
    c.scrollTop = d.offsetTop - 8;
    const cells = [].slice.call(document.querySelectorAll('.capyui-repcell'));
    const lefts = {};
    cells.forEach(function (x) { lefts[Math.round(x.getBoundingClientRect().left)] = 1; });
    const g = document.querySelector('.capyui-repgrid');
    return { lefts: Object.keys(lefts), display: getComputedStyle(g).display,
             cols: getComputedStyle(g).gridTemplateColumns,
             cellW: Math.round(cells[0].getBoundingClientRect().width),
             font: getComputedStyle(cells[0]).fontSize };
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'qa/Q2-phone.png' });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate((o) => fetch('/shot?name=q2-phone.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), geom);
}
