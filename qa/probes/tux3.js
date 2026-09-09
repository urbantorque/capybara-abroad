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

  // Drop the animal from 20 m over a grid of points on and around the yacht,
  // let it settle, and record where it ends up. That is the true standable
  // surface, whatever the colliders were meant to be.
  const pts = [];
  for (let z = -80; z <= -46; z += 2) pts.push([10, z]);
  for (const x of [6.5, 7.8, 12.2, 13.5]) for (let z = -70; z <= -52; z += 3) pts.push([x, z]);

  const settled = [];
  for (let i = 0; i < pts.length; i += 6) {
    const chunk = pts.slice(i, i + 6);
    const res = await page.evaluate(async (cs) => {
      const g = window.__capy;
      const bd = g.capy.body;
      const out = [];
      for (const [x, z] of cs) {
        bd.position.set(x, 20, z);
        bd.velocity.set(0, 0, 0);
        bd.angularVelocity.set(0, 0, 0);
        bd.previousPosition.copy(bd.position);
        bd.interpolatedPosition.copy(bd.position);
        await new Promise(r => setTimeout(r, 1400));
        out.push({ x, z, y: +bd.position.y.toFixed(2),
                   dx: +(bd.position.x - x).toFixed(2), dz: +(bd.position.z - z).toFixed(2) });
      }
      return out;
    }, chunk);
    settled.push(...res);
  }

  await page.evaluate(async (o) => {
    await fetch('/shot?name=tux3.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, settled);
}
