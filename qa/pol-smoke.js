async page => {
  const NAMES = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift',
                 'venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic',
                 'monaco','hanoi'];
  const out = [];
  for (let i = 0; i < NAMES.length; i += 5) {
    await page.reload();
    await page.waitForTimeout(4500);
    const part = await page.evaluate(async (batch) => {
      const g = window.__capy;
      const res = [];
      for (const name of batch) {
        g.biome.switchTo(name);
        const sp = g.biome.spawnOf(name), b = g.capy.body;
        b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0);
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
        let nan = 0;
        for (let f = 0; f < 900; f++) {
          g.tick(1 / 60, f % 30 === 0);
          const p = g.capy.body.position;
          if (!(p.x === p.x && p.y === p.y && p.z === p.z)) { nan++; break; }
        }
        res.push({ name, biome: g.biome.current, nan,
                   err: g.state.lastError ? String(g.state.lastError) : null });
      }
      return res;
    }, NAMES.slice(i, i + 5));
    for (const r of part) out.push(r);
  }
  await page.evaluate((o) => fetch('/shot?name=pol-smoke.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out);
}
