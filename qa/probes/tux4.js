async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(1500);

  await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('monaco');
    const sp = g.biome.spawnOf('monaco');
    const bd = g.capy.body;
    bd.position.set(sp.x, sp.y, sp.z);
    bd.velocity.set(0, 0, 0);
    bd.previousPosition.copy(bd.position);
    bd.interpolatedPosition.copy(bd.position);
  });
  await page.waitForTimeout(2500);

  const pts = [];
  for (let z = -76; z <= -69; z += 0.5) pts.push([7.8, z]);   // flight A lane
  for (let z = -58.5; z <= -53; z += 0.5) pts.push([10, z]);  // flight B lane

  const settled = [];
  for (let i = 0; i < pts.length; i += 6) {
    const res = await page.evaluate(async (cs) => {
      const g = window.__capy;
      const bd = g.capy.body;
      const out = [];
      for (const [x, z] of cs) {
        bd.position.set(x, 14, z);
        bd.velocity.set(0, 0, 0);
        bd.angularVelocity.set(0, 0, 0);
        bd.previousPosition.copy(bd.position);
        bd.interpolatedPosition.copy(bd.position);
        await new Promise(r => setTimeout(r, 1200));
        out.push({ x, z, y: +bd.position.y.toFixed(2) });
      }
      return out;
    }, pts.slice(i, i + 6));
    settled.push(...res);
  }

  await page.evaluate(async (o) => {
    await fetch('/shot?name=tux4.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, settled);
}
