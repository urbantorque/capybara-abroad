async page => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:5188/');
  await page.waitForTimeout(5500);
  await page.screenshot({ path: 'qa/UI-p1-1440.png' });
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(1400);
  await page.screenshot({ path: 'qa/UI-p2-1440.png' });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'qa/UI-p2-1280.png' });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'qa/UI-p1-1280.png' });
  await page.setViewportSize({ width: 900, height: 1000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'qa/UI-p1-900.png' });
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(1400);
  await page.screenshot({ path: 'qa/UI-p2-900.png' });
}
