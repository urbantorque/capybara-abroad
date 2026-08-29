async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://localhost:5199/index.html?cb=' + Math.random());
  await page.waitForTimeout(7000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2500);
  const R = await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('rio');
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
    // what solid geometry is anywhere near the cable line between the station
    // and Morro da Urca, at the height the car flies?
    const near = [];
    const P = { x: 72, y: 37, z: -36 };
    for (const bd of g.world.bodies) {
      if (bd.mass > 0) continue;
      for (let si = 0; si < bd.shapes.length; si++) {
        const s = bd.shapes[si];
        const o = bd.shapeOffsets[si];
        const wx = bd.position.x + o.x, wy = bd.position.y + o.y, wz = bd.position.z + o.z;
        const d = Math.hypot(wx - P.x, wy - P.y, wz - P.z);
        if (d < 14) {
          near.push({ d: +d.toFixed(1), type: s.type, kin: bd.type === 4,
                      he: s.halfExtents ? [+s.halfExtents.x.toFixed(2), +s.halfExtents.y.toFixed(2), +s.halfExtents.z.toFixed(2)] : null,
                      at: [+wx.toFixed(1), +wy.toFixed(1), +wz.toFixed(1)] });
        }
      }
    }
    near.sort((a, b2) => a.d - b2.d);
    return { near: near.slice(0, 14), err: g.state.lastError || null };
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rb-carry5.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, R);
}
