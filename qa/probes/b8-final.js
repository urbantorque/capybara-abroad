async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2500);
  const out = { soak: {} };
  for (const nm of ['pasto', 'sydney']) {
    out.soak[nm] = await page.evaluate(async (nm) => {
      const g = window.__capy;
      if (g.biome.current !== nm) g.biome.switchTo(nm);
      for (let i = 0; i < 30; i++) g.tick(1 / 60, false);
      if (g.biome.current !== nm) return { bad: 'wrong biome' };
      const sp = g.biome.spawnOf(nm), b = g.capy.body;
      b.position.set(sp.x, (sp.y || 1) + 0.4, sp.z);
      b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      for (let t = 0; t < 3600; t++) {
        if (t > 300) { g.input.x = Math.sin(t / 120) * 0.95; g.input.z = Math.cos(t / 175) * 0.95; }
        g.tick(1 / 60, false);
      }
      g.input.x = 0; g.input.z = 0;
      return { biome: g.biome.current, bodies: g.world.bodies.length,
               lastError: g.state.lastError ? String(g.state.lastError).slice(0, 160) : null,
               y: +b.position.y.toFixed(2),
               dist: +Math.hypot(b.position.x - sp.x, b.position.z - sp.z).toFixed(1) };
    }, nm);
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b8-final.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);
}
