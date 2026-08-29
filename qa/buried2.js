async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5500);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2000);

  // The slabs the buried-platform detector flagged outside the cave, and the
  // question that matters about each: is it a floor a player would expect to
  // stand on, or a foundation inside terrain nobody can get to?
  const SPOTS = {
    cali: [[-122, 47.1, -78.2], [-122, 47.5, -79.3]],
    kowloon: [[0, -0.05, -60], [0, -0.05, -67.2], [0, -0.05, -69.6]],
    pantanal: [[55.2, 2.86, 17]],
    antarctic: [[28.6, 9.4, 68.2], [-128.2, 10.3, -221.8], [-152.1, 13.9, -421.1],
                [-128.8, 8.2, -418.5], [87.7, 1.7, -312.3], [101.5, 2.9, -395.4]],
    monaco: [[137.5, 29.8, 108], [141, 29.3, 111]],
  };
  const out = {};
  for (const b in SPOTS) {
    await page.evaluate((n) => { window.__capy.biome.switchTo(n); }, b);
    await page.waitForTimeout(2200);
    out[b] = await page.evaluate(async (pts) => {
      const g = window.__capy;
      const bd = g.capy.body;
      const res = [];
      for (const [x, y, z] of pts) {
        bd.position.set(x, y + 8, z);
        bd.velocity.set(0, 0, 0); bd.angularVelocity.set(0, 0, 0);
        bd.previousPosition.copy(bd.position); bd.interpolatedPosition.copy(bd.position);
        await new Promise(r => setTimeout(r, 2000));
        const p = g.capy.position;
        res.push({ slabTop: y,
                   land: [+p.x.toFixed(1), +p.y.toFixed(2), +p.z.toFixed(1)],
                   standsOn: +(p.y - 0.34).toFixed(2),
                   over: +((p.y - 0.34) - y).toFixed(2),
                   drift: +Math.hypot(p.x - x, p.z - z).toFixed(1) });
      }
      return res;
    }, SPOTS[b]);
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=buried2.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
