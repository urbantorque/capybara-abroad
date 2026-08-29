async page => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:5188/');
  await page.waitForTimeout(5000);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(1600);
  await page.screenshot({ path: 'qa/UI-close-shelf.png', clip: { x: 200, y: 350, width: 700, height: 360 } });
  await page.screenshot({ path: 'qa/UI-close-hero.png', clip: { x: 195, y: 170, width: 1055, height: 180 } });
  const tile = page.locator('.capyui-pick').nth(3);
  await tile.hover();
  await page.waitForTimeout(230);
  await page.screenshot({ path: 'qa/UI-close-sheen.png', clip: { x: 200, y: 350, width: 700, height: 200 } });
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'qa/UI-close-hover.png', clip: { x: 200, y: 350, width: 700, height: 200 } });
}
