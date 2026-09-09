async page => {
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4300);
  await page.keyboard.press('BracketLeft');
  await page.waitForTimeout(5800);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.querySelector('.capyui-touch').classList.add('on'));
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'qa/px-land-844x390.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'qa/px-land-390x844.png' });
}
