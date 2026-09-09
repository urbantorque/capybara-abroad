async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5500);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2500);
  const out = {};
  out.api = await page.evaluate(() => {
    const g = window.__capy;
    return { groundY: typeof g.groundY, npcs: Array.isArray(g.npcs) ? g.npcs.length : typeof g.npcs,
             keys: Object.keys(g).filter(k => /npc|ground|terrain/i.test(k)) };
  });
  // Iceland: what slip is actually reachable
  await page.evaluate(() => { window.__capy.biome.switchTo('iceland'); });
  await page.waitForTimeout(2600);
  out.iceland = await page.evaluate(() => {
    const g = window.__capy, c = g.capy, b = c.body;
    const sp = g.biome.spawnOf('iceland');
    let maxSlip = 0, at = null, n = 0;
    for (let r = 20; r <= 300; r += 25) {
      for (let a = 0; a < 6.28; a += 0.6) {
        const x = sp.x + Math.sin(a) * r, z = sp.z + Math.cos(a) * r;
        b.position.set(x, 400, z); b.velocity.set(0, 0, 0);
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
        for (let i = 0; i < 150; i++) g.tick(1 / 60, false);
        n++;
        if (c.slip > maxSlip) { maxSlip = c.slip; at = [+x.toFixed(0), +b.position.y.toFixed(1), +z.toFixed(0)]; }
      }
    }
    return { probes: n, maxSlip: +maxSlip.toFixed(3), at };
  });
  // Kowloon: the distribution of climb-hold tops
  await page.evaluate(() => { window.__capy.biome.switchTo('kowloon'); });
  await page.waitForTimeout(2600);
  out.kowloon = await page.evaluate(() => {
    const g = window.__capy, c = g.capy;
    const sp = g.biome.spawnOf('kowloon');
    const tops = [];
    for (let r = 3; r <= 30; r += 1.2) {
      for (let a = 0; a < 6.28; a += 0.25) {
        const x = sp.x + Math.sin(a) * r, z = sp.z + Math.cos(a) * r;
        const h = c.climbAt(x, sp.y + 0.5, z, a);
        if (h) tops.push({ top: h.top === undefined ? null : +h.top.toFixed(1),
                           x: +x.toFixed(1), z: +z.toFixed(1), yaw: +a.toFixed(2) });
      }
    }
    return { holds: tops.length, spawnY: +sp.y.toFixed(2), sample: tops.slice(0, 12) };
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=diag.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
