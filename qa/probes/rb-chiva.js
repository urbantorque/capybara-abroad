async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://localhost:5199/index.html?cb=' + Math.random());
  await page.waitForTimeout(7000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2500);
  const R = await page.evaluate(() => {
    const g = window.__capy; const A = g.cali;
    g.biome.switchTo('cali');
    for (let i = 0; i < 180; i++) g.tick(1 / 60, false);
    const b = g.capy.body;
    const ch = A.chivaAt();
    b.position.set(ch.x, ch.y + 4.1, ch.z); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    const S = { rows: [] };
    for (let i = 0; i < 900; i++) {
      g.tick(1 / 60, false);
      if (i % 20 === 0) {
        const q = A.chivaAt();
        // chiva-local: +z is the way she points
        const dx = g.capy.position.x - q.x, dz = g.capy.position.z - q.z;
        const c = Math.cos(q.yaw), s = Math.sin(q.yaw);
        S.rows.push([i, A.onChiva() ? 1 : 0,
                     +(dx * c - dz * s).toFixed(2),
                     +(dx * s + dz * c).toFixed(2),
                     +(g.capy.position.y - q.y).toFixed(2),
                     +q.v.toFixed(1), +A.wireLead().toFixed(2)]);
      }
    }
    S.err = g.state.lastError || null;
    return S;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rb-chiva.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, R);
}
