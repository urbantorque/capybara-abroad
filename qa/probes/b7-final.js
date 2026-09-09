async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(3000);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    if (g.biome.current !== 'sydney') g.biome.switchTo('sydney');
    for (let i = 0; i < 30; i++) g.tick(1 / 60, false);
    const r = { live: g.biome.current, runs: [] };
    const sp = g.biome.spawnOf('sydney'), b = g.capy.body;
    // does the railing STOP you, and does the toast still fire behind it?
    for (const [nm, ix, iz] of [['north', 0, 1], ['east', 1, 0.35], ['west', -1, 0.35],
                                ['ne', 0.75, 0.75], ['nw', -0.75, 0.75]]) {
      b.position.set(sp.x, 1, sp.z); b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      g.capy.carriedBy = null;
      let maxZ = -999, maxD = 0, rescued = false;
      const z0 = sp.z, x0 = sp.x;
      for (let t = 0; t < 1500; t++) {
        g.input.x = ix; g.input.z = iz; g.input.run = true;
        g.tick(1 / 60, false);
        const d = Math.hypot(b.position.x - x0, b.position.z - z0);
        if (d > maxD) maxD = d;
        if (b.position.z > maxZ) maxZ = b.position.z;
        if (d < 4 && t > 400) { rescued = true; break; }
      }
      g.input.x = 0; g.input.z = 0; g.input.run = false;
      r.runs.push({ dir: nm, endX: +b.position.x.toFixed(1), endZ: +b.position.z.toFixed(1),
                    maxZ: +maxZ.toFixed(1), maxDist: +maxD.toFixed(1), rescued: rescued });
    }
    // soak
    b.position.set(sp.x, 1, sp.z); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    for (let t = 0; t < 3600; t++) {
      if (t > 300) { g.input.x = Math.sin(t / 120) * 0.9; g.input.z = Math.cos(t / 175) * 0.9; }
      g.tick(1 / 60, false);
    }
    g.input.x = 0; g.input.z = 0;
    r.lastError = g.state.lastError ? String(g.state.lastError).slice(0, 160) : null;
    r.bodies = g.world.bodies.length;
    r.endY = +b.position.y.toFixed(2);
    return r;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b7-final.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);
}
