async page => {
  // Monte Carlo, third pass. The gaps in the palm row are at x = 10.15, 19.25
  // and 28.35, so a boom that runs straight down a gap is the only one that is
  // clear of a crown — which pins the bearing to the chapter's shipped yaw of
  // pi and pins the spawn to a gap. What is left to choose is the BOOM: how far
  // back down the gap the lens stands, and how high it looks.
  const JOBS = [
    { name: 'mc-H', x: 10, z: -80, yaw: Math.PI, dist: 20, pitch: 0.30, raise: 3.5 },
    { name: 'mc-I', x: 10, z: -80, yaw: Math.PI, dist: 26, pitch: 0.26, raise: 4.5 },
    { name: 'mc-J', x: 10, z: -80, yaw: 3.02,    dist: 22, pitch: 0.28, raise: 4.0 },
  ];
  for (let i = 0; i < JOBS.length; i++) {
    const j = JOBS[i];
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload();
    await page.waitForTimeout(5000);
    await page.evaluate((a) => {
      const s = window.__capy.biome.MONACO_SPAWN;
      s.x = a.x; s.z = a.z; s.yaw = a.yaw;
      s.dist = a.dist; s.pitch = a.pitch; s.raise = a.raise;
    }, j);
    await page.keyboard.press('Period');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'qa/B6-' + j.name + '.png' });
  }
}
