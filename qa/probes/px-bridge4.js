// WHERE THE WATER ACTUALLY IS ROUND THE BRIDGE'S LANDFALL.
// px-bridge3 found no point in 130 m of +z that is both isOverWater and under
// the waterline. Before concluding anything, look at the ground itself: profile
// terrain and isOverWater outward from the bluff in all four directions.
async page => {
  const out = {};
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4200);
  await page.keyboard.press('Digit3');
  await page.waitForTimeout(7000);
  out.biome = await page.evaluate(() => window.__capy.biome.current);
  out.rays = await page.evaluate(() => {
    const g = window.__capy, a = g.quay, B = a.bridge;
    const cs = Math.cos(B.yaw), sn = Math.sin(B.yaw);
    const bx = B.x + 190 * cs, bz = B.z - 190 * sn;
    const dirs = [['+z', 0, 1], ['-z', 0, -1], ['+x', 1, 0], ['-x', -1, 0]];
    const outv = {};
    for (const [nm, dx, dz] of dirs) {
      const row = [];
      for (let d = 0; d <= 120; d += 10) {
        const x = bx + dx * d, z = bz + dz * d;
        row.push({ d, t: +a.terrainHeight(x, z).toFixed(1), w: a.isOverWater(x, z) ? 1 : 0 });
      }
      outv[nm] = row;
    }
    return { bluff: [+bx.toFixed(1), +bz.toFixed(1)], waterLevel: a.waterLevel, dirs: outv };
  });
  await page.evaluate(o => fetch('/shot?name=px-bridge4.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
