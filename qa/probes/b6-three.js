async page => {
  // Three chapters re-shot after the fix pass, through the picker like the
  // nineteen. Cali is photographed TWICE — once on its shipped heading and
  // once aimed at the Ermita — because the paragraph names both and only the
  // picture can settle which one is the better arrival.
  const JOBS = [
    { key: 'Digit8',  name: 'sahara',  yaw: null },
    { key: 'Period',  name: 'monaco',  yaw: null },
    { key: 'Digit5',  name: 'cali',    yaw: null },
    { key: 'Digit5',  name: 'cali-ermita', yaw: -1.5600 },
  ];
  for (let i = 0; i < JOBS.length; i++) {
    const j = JOBS[i];
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload();
    await page.waitForTimeout(5000);
    if (j.yaw !== null) {
      // Override the spawn record BEFORE the picker lands, so what is
      // photographed is a real arrival through teleportCapy and frameShot and
      // not a camera nudged after the fact.
      await page.evaluate((y) => { window.__capy.biome.CALI_SPAWN.yaw = y; }, j.yaw);
    }
    await page.keyboard.press(j.key);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'qa/B6-fix-' + j.name + '.png' });
  }
}
