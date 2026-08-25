async page => {
  await page.evaluate(() => {
    const g = window.__capy;
    window.__creep = (dt, secs) => {
      g.biome.switchTo('cave');
      const cav = g.cave, b = g.capy.body, sp = cav.SPAWN;
      b.position.set(sp.x, cav.terrainHeight(sp.x, sp.z) + 0.4, sp.z);
      b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      g.input.x = 0; g.input.z = 0; g.input.action = false; g.input.run = false;
      const n = Math.round(secs / dt);
      for (let i = 0; i < Math.round(3 / dt); i++) g.tick(dt, false);
      const c0 = g.capy.position, a = { x: c0.x, z: c0.z };
      for (let i = 0; i < n; i++) g.tick(dt, false);
      const c = g.capy.position;
      const moved = Math.hypot(c.x - a.x, c.z - a.z);
      return { dt: +dt.toFixed(5), secs, moved: +moved.toFixed(3), mps: +(moved / secs).toFixed(4),
               predicted: +(24 * 0.055 * dt).toFixed(4),
               vel: +Math.hypot(b.velocity.x, b.velocity.z).toFixed(4) };
    };
  });
  const rows = [];
  for (const dt of [1 / 30, 1 / 60, 1 / 120, 1 / 240])
    rows.push(await page.evaluate(d => window.__creep(d, 20), dt));
  await page.evaluate(async o => {
    await fetch('/shot?name=b4cav-10.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, rows);
}
