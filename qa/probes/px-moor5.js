// EVERY MOORED YACHT, CHECKED AGAINST THE WATER SHE IS DRAWN ON.
// One row per hull: is she over water, how deep is the ground under her, and
// how much clear water is round her at a hull's length.
async page => {
  const out = {};
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4200);
  await page.keyboard.press('Digit3');
  await page.waitForTimeout(7000);
  out.biome = await page.evaluate(() => window.__capy.biome.current);
  out.hulls = await page.evaluate(() => {
    const g = window.__capy, a = g[g.biome.current];
    // The mooring boxes are the only 1-shape static bodies 7.2 m long sitting
    // at y -0.2 in this chapter; that signature identifies them without a hook.
    const rows = [];
    for (const b of g.world.bodies) {
      if (b.mass !== 0 || b.type === g.CANNON.Body.KINEMATIC) continue;
      if (b.shapes.length !== 1) continue;
      const s = b.shapes[0];
      if (!s.halfExtents) continue;
      if (Math.abs(s.halfExtents.z - 3.60) > 0.01 || Math.abs(s.halfExtents.x - 0.85) > 0.01) continue;
      const x = b.position.x, z = b.position.z;
      let room = 0;
      for (let d = 0; d < 4; d++) {
        const th = d * Math.PI / 2;
        if (a.isOverWater(x + Math.cos(th) * 7, z + Math.sin(th) * 7)) room++;
      }
      rows.push({ x: +x.toFixed(1), z: +z.toFixed(1), wet: !!a.isOverWater(x, z),
                  terrain: +a.terrainHeight(x, z).toFixed(1), room });
    }
    return rows;
  });
  out.err = await page.evaluate(() =>
    (window.__capyErr && window.__capyErr.length) ? String(window.__capyErr[0]) : null);
  await page.evaluate(o => fetch('/shot?name=px-moor5.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
