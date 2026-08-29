async page => {
  await page.reload();
  await page.waitForTimeout(6000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2500);
  const out = {};
  for (const n of ['venice', 'kowloon', 'palawan', 'goreme', 'manly']) {
    await page.evaluate((name) => {
      const g = window.__capy;
      g.biome.switchTo(name);
      const sp = g.biome.spawnOf(name), b = g.capy.body;
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    }, n);
    // let it settle in real time — a prop that slides does it under gravity
    for (let i = 0; i < 4; i++) await page.evaluate(() => new Promise(r => setTimeout(r, 5000)));
    out[n] = await page.evaluate((name) => {
      const g = window.__capy;
      const api = g[name];
      const roam = [];
      let n2 = 0, sunk = 0, air = 0;
      for (const p of g.props) {
        if (p.biome && p.biome !== name) continue;
        if (p.removed || p.hidden || p.held) continue;
        n2++;
        const bp = p.body.position;
        const d = Math.hypot(bp.x - p.homeX, bp.z - p.homeZ);
        const gy = api && api.terrainHeight ? api.terrainHeight(bp.x, bp.z) : 0;
        if (bp.y < gy - 0.6) sunk++;
        if (bp.y > gy + 1.4 && p.body.sleepState === 2) air++;
        if (d > 6) {
          roam.push({ id: p.id || p.kind || '?', d: +d.toFixed(2),
                      inWater: !!p.inWater, mass: p.mass,
                      touched: p.lastCapyTouch > -1e8,
                      at: [+bp.x.toFixed(1), +bp.y.toFixed(1), +bp.z.toFixed(1)],
                      home: [+p.homeX.toFixed(1), +p.homeZ.toFixed(1)],
                      v: +Math.hypot(p.body.velocity.x, p.body.velocity.z).toFixed(2),
                      sleep: p.body.sleepState });
        }
      }
      const locals = (g.locals || []).filter(r => r.biome === name);
      const npcs = (g.npcs || []).filter(q => !q.biome || q.biome === name);
      return { props: n2, sunk, air, roam: roam.slice(0, 12),
               locals: locals.length, npcs: npcs.length,
               localNames: locals.map(r => r.key || r.name || '?') };
    }, n);
  }
  await page.evaluate((o) => fetch('/shot?name=bx-props.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
