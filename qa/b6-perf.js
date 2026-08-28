async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2500);
  const out = { rows: [] };
  for (const nm of ['sahara', 'rio', 'kowloon', 'sydney']) {
    let row;
    try {
      row = await page.evaluate(async (nm) => {
        const g = window.__capy;
        if (g.biome.current !== nm) g.biome.switchTo(nm);
        for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
        const sp = g.biome.spawnOf(nm), b = g.capy.body;
        b.position.set(sp.x, (sp.y || 1) + 0.4, sp.z);
        b.velocity.set(0, 0, 0);
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
        for (let i = 0; i < 120; i++) g.tick(1 / 60, false);
        const ts = [];
        for (let i = 0; i < 300; i++) {
          g.input.x = Math.sin(i / 40) * 0.8; g.input.z = 0.8;
          const t0 = performance.now();
          g.tick(1 / 60, false);
          ts.push(performance.now() - t0);
        }
        g.input.x = 0; g.input.z = 0;
        ts.sort((a, c) => a - c);
        return { biome: g.biome.current, bodies: g.world.bodies.length,
                 med: +ts[150].toFixed(3), p90: +ts[270].toFixed(3) };
      }, nm);
    } catch (e) { row = { biome: nm, error: String(e).slice(0, 200) }; }
    out.rows.push(row);
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b6-perf.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);
}
