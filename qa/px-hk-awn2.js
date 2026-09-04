// HOW HIGH IS THE THING THE LENS IS INSIDE, AND WHERE DOES IT REACH?
//
// px-hk-awn.js proved the occluder is drawn-only (physHit null on 15 of 16
// occluded frames) and that naming it is no help: Mong Kok is ONE merged mesh
// 57 x 49 x 110 m, so "which object" has a single, useless answer. camCeil is
// the remaining lever — the souk's — and camCeil needs a height and a
// rectangle, not a name. So: stand at the occluded spots and ray straight up
// from the animal's head to find the underside of whatever is over the street.
async page => {
  const out = { column: [] };
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4200);
  await page.keyboard.press('Minus');
  await page.waitForTimeout(6500);
  out.biome = await page.evaluate(() => window.__capy.biome.current);
  out.column = await page.evaluate(() => {
    const g = window.__capy, T = g.THREE;
    const rc = new T.Raycaster(), up = new T.Vector3(0, 1, 0);
    const vis = (o) => { while (o) { if (o.visible === false) return false; o = o.parent; } return true; };
    const rows = [];
    // down the street the walk covers, and across it
    for (let x = 2; x >= -16; x -= 2) {
      for (const z of [30, 32, 34, 36]) {
        const a = g[g.biome.current];
        const gy = a.terrainHeight(x, z);
        rc.set(new T.Vector3(x, gy + 0.6, z), up);
        rc.near = 0.05; rc.far = 60;
        const hits = rc.intersectObjects(g.scene.children, true).filter(h => {
          const o = h.object;
          if (!o.isMesh && !o.isInstancedMesh) return false;
          if (!vis(o)) return false;
          const m = Array.isArray(o.material) ? o.material[0] : o.material;
          return m && !(m.transparent && m.opacity < 0.35) && m.depthWrite !== false;
        });
        rows.push({ x, z, ground: +gy.toFixed(2),
                    over: hits.slice(0, 3).map(h => +(gy + 0.6 + h.distance).toFixed(2)) });
      }
    }
    return rows;
  });
  await page.evaluate(o => fetch('/shot?name=px-hk-awn2.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
