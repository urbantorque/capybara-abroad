async page => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:5188/');
  await page.waitForTimeout(6500);
  for (const b of [0, 2, 5]) {
    await page.evaluate(px => {
      let s = document.getElementById('__blur');
      if (!s) { s = document.createElement('style'); s.id = '__blur'; document.head.appendChild(s); }
      s.textContent = '.capyui-title{backdrop-filter:blur(' + px +
        'px) saturate(1.06)!important;-webkit-backdrop-filter:blur(' + px +
        'px) saturate(1.06)!important;}';
    }, b);
    await page.waitForTimeout(600);
    // the whole frame, and a clip of the card's top-left corner where the
    // paper meets the world — the join the blur exists to make readable
    await page.screenshot({ path: 'qa/TW-' + b + '.png' });
    await page.screenshot({ path: 'qa/TW-' + b + '-corner.png',
      clip: { x: 330, y: 190, width: 460, height: 210 } });
  }
  await page.evaluate(() => { const s = document.getElementById('__blur'); if (s) s.remove(); });
}
