async page => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:5188/');
  await page.waitForTimeout(6000);
  await page.screenshot({ path: 'qa/AUD-p1-1440.png' });
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(1600);
  await page.screenshot({ path: 'qa/AUD-p2-1440.png' });
  await page.mouse.move(720, 450);
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'qa/AUD-p2-hover-1440.png' });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'qa/AUD-p2-1920.png' });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1400);
  await page.screenshot({ path: 'qa/AUD-p1-1920.png' });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'qa/AUD-p1-1280.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'qa/AUD-p1-390.png' });
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(1400);
  await page.screenshot({ path: 'qa/AUD-p2-390.png' });
}
