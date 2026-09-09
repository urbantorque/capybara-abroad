async page => {
  const JOBS = [
    { name: 'mc-K', raise: 3.6 },
    { name: 'mc-L', raise: 4.4 },
  ];
  for (let i = 0; i < JOBS.length; i++) {
    const j = JOBS[i];
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload();
    await page.waitForTimeout(5000);
    await page.evaluate((r) => { window.__capy.biome.MONACO_SPAWN.raise = r; }, j.raise);
    await page.keyboard.press('Period');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'qa/B6-' + j.name + '.png' });
  }
}
