async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5500);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2500);
  const BIOMES = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift',
                  'venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic',
                  'monaco','hanoi'];
  const rows = [];
  for (const b of BIOMES) {
    await page.evaluate((n) => {
      const g = window.__capy;
      g.biome.switchTo(n);
      const sp = g.biome.spawnOf(n), bd = g.capy.body;
      bd.position.set(sp.x, sp.y + 0.4, sp.z); bd.velocity.set(0, 0, 0);
      bd.previousPosition.copy(bd.position); bd.interpolatedPosition.copy(bd.position);
    }, b);
    await page.waitForTimeout(1200);
    rows.push(await page.evaluate(() => {
      const g = window.__capy, c = g.capy;
      const IDS = ['lungs','quiet','beat','carve','vault','seed','mantle','float','flow'];
      const down = k => window.dispatchEvent(new KeyboardEvent('keydown', { code: k, bubbles: true }));
      const up = k => window.dispatchEvent(new KeyboardEvent('keyup', { code: k, bubbles: true }));
      // every skill on, and every key that touches one held, for four seconds
      down('KeyW'); down('ShiftLeft'); down('Space');
      for (let i = 0; i < 60 * 4; i++) { IDS.forEach(s => c.learn(s, true)); g.tick(1 / 60, false); }
      up('KeyW'); up('ShiftLeft'); up('Space');
      for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
      const p = c.position;
      return { biome: g.biome.current,
               pos: [+p.x.toFixed(0), +p.y.toFixed(1), +p.z.toFixed(0)],
               nan: !(p.x === p.x && p.y === p.y && p.z === p.z),
               drifting: !!c.drifting, committed: !!c.committed,
               err: g.state.lastError || null };
    }));
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=skillsoak.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, rows);
}
