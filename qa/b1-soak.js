async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(3000);

  const src = await (await page.request.get('http://localhost:5188/src/shared.js')).text();
  const chapters = [];
  const re = /\{\s*n:\s*(\d+),\s*biome:\s*'([a-z]+)'/g;
  let m;
  while ((m = re.exec(src))) chapters.push(m[2]);

  const out = { started: await page.evaluate(() => !!window.__capy.state.started), rows: [] };

  // ALL nineteen: sit on the spawn and wander a little for 20 s of sim, and
  // assert that the new bounds NEVER fire. A false positive here would be far
  // worse than the bug being fixed — it is a rescue in the middle of the world.
  for (const name of chapters) {
    let row;
    try {
      row = await page.evaluate(async (nm) => {
        const g = window.__capy;
        if (g.biome.current !== nm) g.biome.switchTo(nm);
        for (let i = 0; i < 25; i++) g.tick(1 / 60, false);
        const r = { biome: nm, live: g.biome.current };
        const sp = g.biome.spawnOf(nm);
        const b = g.capy.body;
        b.position.set(sp.x, (sp.y || 1) + 0.4, sp.z);
        b.velocity.set(0, 0, 0);
        b.previousPosition.copy(b.position);
        b.interpolatedPosition.copy(b.position);
        g.capy.carriedBy = null;
        let jumps = 0, maxR = 0;
        let lx = b.position.x, lz = b.position.z;
        for (let t = 0; t < 1200; t++) {          // 20 s
          // a slow drift outward so it is not a static test
          if (t % 90 === 0) {
            const a = (t / 90) * 0.8;
            b.velocity.x = Math.cos(a) * 2.2;
            b.velocity.z = Math.sin(a) * 2.2;
          }
          g.tick(1 / 60, false);
          const d = Math.hypot(b.position.x - lx, b.position.z - lz);
          if (d > 12) jumps++;                    // a rescue teleport
          lx = b.position.x; lz = b.position.z;
          const R = Math.hypot(b.position.x - sp.x, b.position.z - sp.z);
          if (R > maxR) maxR = R;
        }
        r.spuriousRescues = jumps;
        r.wanderedTo = Math.round(maxR);
        r.lastError = g.state.lastError ? String(g.state.lastError).slice(0, 120) : null;
        const box = g.biome.boundsOf(nm);
        r.box = box ? Math.round(box.x1 - box.x0) + 'x' + Math.round(box.z1 - box.z0) : null;
        return r;
      }, name);
    } catch (e) {
      row = { biome: name, error: String(e).slice(0, 200) };
    }
    out.rows.push(row);
  }

  await page.evaluate(async (o) => {
    await fetch('/shot?name=b1-soak.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);
}
