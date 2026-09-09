// WHAT IS ACTUALLY STANDING IN THE MOORING FIELDS.
// px-moor2 put the animal on a hull at (-92.5, -172) and it ended up at y 21.34
// standing on something 21 m tall. Either the fields overlap land, or the new
// boxes are not where they are drawn. Enumerate the static bodies near each
// field centre with their AABBs and their shape counts.
async page => {
  const out = {};
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4200);
  await page.keyboard.press('Digit3');
  await page.waitForTimeout(7000);
  out.biome = await page.evaluate(() => window.__capy.biome.current);
  out.near = await page.evaluate(() => {
    const g = window.__capy;
    const F = [{ x: -104, z: -172 }, { x: 176, z: -262 }, { x: -64, z: -330 }];
    return F.map(f => {
      const hits = [];
      for (const b of g.world.bodies) {
        if (b.mass !== 0 || b.type === g.CANNON.Body.KINEMATIC) continue;
        const d = Math.hypot(b.position.x - f.x, b.position.z - f.z);
        if (d > 46) continue;
        b.updateAABB();
        hits.push({ d: +d.toFixed(1), shapes: b.shapes.length,
                    y: +b.position.y.toFixed(2),
                    aabb: [+b.aabb.lowerBound.y.toFixed(1), +b.aabb.upperBound.y.toFixed(1)],
                    w: +(b.aabb.upperBound.x - b.aabb.lowerBound.x).toFixed(1),
                    l: +(b.aabb.upperBound.z - b.aabb.lowerBound.z).toFixed(1) });
      }
      hits.sort((a, b2) => b2.aabb[1] - a.aabb[1]);
      return { at: [f.x, f.z], n: hits.length, tallest: hits.slice(0, 5) };
    });
  });
  // ...and the drawn terrain height at those points, which says whether the
  // field is over water at all.
  out.ground = await page.evaluate(() => {
    const g = window.__capy, a = g[g.biome.current];
    const F = [{ x: -104, z: -172 }, { x: 176, z: -262 }, { x: -64, z: -330 }];
    return F.map(f => ({ at: [f.x, f.z],
      terrain: +a.terrainHeight(f.x, f.z).toFixed(2),
      overWater: !!a.isOverWater(f.x, f.z),
      water: +a.waterHeightAt(f.x, f.z).toFixed(2) }));
  });
  await page.evaluate(o => fetch('/shot?name=px-moor3.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
