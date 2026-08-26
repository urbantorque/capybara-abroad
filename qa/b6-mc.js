async page => {
  // Monte Carlo's arrival, four poses, and Marrakech's raise split.
  // The palm row along z = monPORT.z0 - 6.5 = -84.5 runs x -40..42 in ten
  // places, so the camera boom — which for any bearing at the yacht swings
  // SOUTH of the spawn — parks inside the crown of the palm at x 32.9. The
  // question this script settles is which of boom length, pitch and bearing
  // gets the camera clear of it without losing the yacht.
  const JOBS = [
    { name: 'mc-A', key: 'Period', sp: 'MONACO_SPAWN', o: { yaw: 2.379, dist: 5.0,  pitch: 0.28, raise: 2.0 } },
    { name: 'mc-B', key: 'Period', sp: 'MONACO_SPAWN', o: { yaw: 2.379, dist: 9.0,  pitch: 0.55, raise: 1.0 } },
    { name: 'mc-C', key: 'Period', sp: 'MONACO_SPAWN', o: { yaw: 2.379, dist: 14.0, pitch: 0.44, raise: 2.5 } },
    { name: 'mc-D', key: 'Period', sp: 'MONACO_SPAWN', o: { yaw: 2.10,  dist: 10.0, pitch: 0.34, raise: 2.0 } },
    { name: 'sah-35', key: 'Digit8', sp: 'SAHARA_SPAWN', o: { yaw: 1.4940, raise: 3.5 } },
  ];
  for (let i = 0; i < JOBS.length; i++) {
    const j = JOBS[i];
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload();
    await page.waitForTimeout(5000);
    await page.evaluate((a) => {
      const s = window.__capy.biome[a.sp];
      delete s.dist; delete s.pitch; delete s.raise;
      for (const k in a.o) s[k] = a.o[k];
    }, { sp: j.sp, o: j.o });
    await page.keyboard.press(j.key);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'qa/B6-' + j.name + '.png' });
  }
}
