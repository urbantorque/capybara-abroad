async page => {
  // Monte Carlo, second pass. The palm row is at z = -84.5 with a palm every
  // 9.1 m from x = -40 to x = 42, so the camera boom — which for ANY bearing
  // at the yacht swings south of the spawn — is inside a crown wherever the
  // spawn sits within about five metres of the row. The only pose that clears
  // it is one whose boom runs down the MIDDLE of a gap, and the gaps are at
  // x = 10, 19.25, 28.35 ... So: keep the chapter's shipped bearing (yaw pi,
  // "facing ACROSS rather than up"), and slide the spawn 20 m west along the
  // same quay so that bearing points AT the yacht instead of past her.
  const JOBS = [
    { name: 'mc-E', x: 10,    z: -80, yaw: Math.PI, dist: null, pitch: null, raise: 2.0 },
    { name: 'mc-F', x: 10,    z: -80, yaw: Math.PI, dist: 13,   pitch: 0.34, raise: 2.6 },
    { name: 'mc-G', x: 19.25, z: -80, yaw: 2.90,    dist: 12,   pitch: 0.32, raise: 2.4 },
  ];
  const out = [];
  for (let i = 0; i < JOBS.length; i++) {
    const j = JOBS[i];
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload();
    await page.waitForTimeout(5000);
    await page.evaluate((a) => {
      const s = window.__capy.biome.MONACO_SPAWN;
      delete s.dist; delete s.pitch; delete s.raise;
      s.x = a.x; s.z = a.z; s.yaw = a.yaw;
      if (a.dist !== null) s.dist = a.dist;
      if (a.pitch !== null) s.pitch = a.pitch;
      if (a.raise !== null) s.raise = a.raise;
    }, j);
    await page.keyboard.press('Period');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'qa/B6-' + j.name + '.png' });
    out.push(await page.evaluate(() => {
      const g = window.__capy, api = g.monaco || {}, p = g.capy.position;
      return { at: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)],
               ground: typeof api.terrainHeight === 'function' ? +api.terrainHeight(p.x, p.z).toFixed(2) : null,
               blocked: typeof api.navBlocked === 'function' ? !!api.navBlocked(p.x, p.z, 0.9) : null,
               overWater: typeof api.isOverWater === 'function' ? !!api.isOverWater(p.x, p.z) : null,
               err: (g.state.lastError && String(g.state.lastError)) || '' };
    }));
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b6-mc2.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
