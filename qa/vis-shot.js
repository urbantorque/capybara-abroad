async page => {
  await page.reload();
  await page.waitForTimeout(5000);
  const KEY = 'Digit6';
  await page.keyboard.press(KEY);
  await page.waitForTimeout(7000);
  await page.evaluate(() => {
    const g = window.__capy;
    return g && g.biome && g.biome.current;
  });
}
