async page => {
  await page.waitForTimeout(3500);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2000);
  const rows = [];
  for (const name of ['venice', 'kowloon', 'palawan', 'goreme', 'manly']) {
    await page.evaluate((n) => {
      const g = window.__capy;
      g.biome.switchTo(n);
      const sp = g.biome.spawnOf(n), b = g.capy.body;
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      g.state.lastError = null;
    }, name);
    const KEYS = ['KeyW', 'KeyD', 'Space', 'KeyE', 'KeyA', 'KeyQ', 'KeyS', 'ShiftLeft'];
    for (let i = 0; i < 16; i++) {
      const k = KEYS[i % KEYS.length];
      await page.keyboard.down(k);
      await page.waitForTimeout(340);
      await page.keyboard.up(k);
      await page.waitForTimeout(120);
    }
    rows.push(await page.evaluate(() => {
      const g = window.__capy, p = g.capy.position, v = g.capy.body.velocity;
      return {
        biome: g.biome.current,
        lastError: g.state.lastError ? String(g.state.lastError) : null,
        nan: !(p.x === p.x && p.y === p.y && p.z === p.z &&
               v.x === v.x && v.y === v.y && v.z === v.z),
        at: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)],
        solverSaves: g.state.solverSaves || 0,
        bodies: g.world.bodies.length,
      };
    }));
  }
  await page.evaluate((o) => fetch('/shot?name=bx-reg.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))),
  }), rows);
}
