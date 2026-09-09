async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(4000);
  const r = await page.evaluate(() => {
    const g = window.__capy;
    const b = g.capy.body;
    // 4 m inside the new land rect's northern edge (z1 = 70): the last legal
    // step. The lawn MESH runs to z = 150, so this is standing on drawn grass.
    b.position.set(0, 0.4, 66);
    b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position);
    b.interpolatedPosition.copy(b.position);
    g.capy.carriedBy = null;
    return { live: g.biome.current };
  });
  await page.waitForTimeout(2500);
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b1-syd-edge.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))),
    });
  }, r);
}
