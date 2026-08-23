async page => {
  await page.setViewportSize({ width: 1200, height: 1000 });
  await page.mouse.click(400, 400);
  await page.waitForTimeout(1600);
  await page.keyboard.press('h');
  await page.waitForTimeout(900);
  await page.evaluate(() => { const d = document.querySelector('.capyui-jrkeys'); if (d) d.scrollIntoView({block:'end'}); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'qa-keys.png' });
}
