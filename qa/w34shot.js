async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2500);
  await page.keyboard.press('KeyK');
  await page.waitForTimeout(1600);
}
