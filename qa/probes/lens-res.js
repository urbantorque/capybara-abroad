async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5200);
  await page.keyboard.press('Period');
  await page.waitForTimeout(8000);
  for (const s of [[1280, 720], [1920, 1080], [2560, 1440]]) {
    await page.setViewportSize({ width: s[0], height: s[1] });
    await page.waitForTimeout(1800);
    await page.screenshot({ path: 'qa/RES-' + s[1] + '.png',
      clip: { x: Math.round(s[0] * 0.66), y: Math.round(s[1] * 0.09),
              width: Math.round(s[0] * 0.22), height: Math.round(s[1] * 0.22) } });
  }
  await page.setViewportSize({ width: 1280, height: 720 });
}
