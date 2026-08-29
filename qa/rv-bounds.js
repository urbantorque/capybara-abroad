async page => {
  await page.reload();
  await page.waitForTimeout(6500);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2000);
  const out = {};
  for (const name of ['sydney', 'pasto', 'quay', 'kyoto']) {
    const head = await page.evaluate((n) => {
      const g = window.__capy;
      g.biome.switchTo(n);
      for (let i = 0; i < 150; i++) g.tick(1 / 60, false);
      const api = n === 'sydney' ? g.env : g[n];
      return { bounds: api.bounds ? api.bounds() : null };
    }, name);
    const rows = [];
    for (let k = 0; k < 8; k++) {
      rows.push(await page.evaluate((arg) => {
        const g = window.__capy, n = arg.n, k = arg.k;
        const api = n === 'sydney' ? g.env : g[n];
        const b = g.capy.body, sp = g.biome.spawnOf(n);
        const a = k / 8 * Math.PI * 2;
        b.position.set(sp.x, sp.y + 0.4, sp.z); b.velocity.set(0, 0, 0);
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
        g.input.x = 0; g.input.z = 0; g.input.run = false;
        for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
        let minY = 1e9, maxD = 0;
        for (let i = 0; i < 60 * 40; i++) {
          const cy = g.input.camYaw || 0;
          const ux = Math.cos(a), uz = Math.sin(a);
          g.input.x = ux * Math.cos(cy) + uz * (-Math.sin(cy));
          g.input.z = -(ux * (-Math.sin(cy)) + uz * (-Math.cos(cy)));
          g.input.run = true;
          g.tick(1 / 60, false);
          const p = g.capy.position;
          if (p.y < minY) minY = p.y;
          const d = Math.hypot(p.x - sp.x, p.z - sp.z);
          if (d > maxD) maxD = d;
        }
        g.input.x = 0; g.input.z = 0; g.input.run = false;
        for (let i = 0; i < 150; i++) g.tick(1 / 60, false);
        const p = g.capy.position;
        const bd = api.bounds ? api.bounds() : null;
        let outside = null;
        if (bd) {
          const list = Array.isArray(bd) ? bd : [bd];
          outside = !list.some(r => p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1);
        }
        return { dir: k, at: [+p.x.toFixed(1), +p.y.toFixed(2), +p.z.toFixed(1)],
                 maxD: +maxD.toFixed(1), minY: +minY.toFixed(2), outside: outside,
                 swimming: !!g.capy.swimming, err: g.state.lastError || null };
      }, { n: name, k }));
    }
    out[name] = { bounds: head.bounds, rows };
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rv-bounds.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
