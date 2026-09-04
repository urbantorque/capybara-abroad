// THE COVERED STRIP OF MONG KOK, AS A RECTANGLE.
// camCeil takes a region and a height, so this maps them: at each point of the
// street, the lowest drawn surface above head height. A cell with nothing over
// it is open sky; a cell at 4.8 is under the canopy; a cell at 30+ is inside a
// building and not street at all.
async page => {
  const out = {};
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4200);
  await page.keyboard.press('Minus');
  await page.waitForTimeout(6500);
  out.biome = await page.evaluate(() => window.__capy.biome.current);
  out.grid = await page.evaluate(() => {
    const g = window.__capy, T = g.THREE, a = g[g.biome.current];
    const rc = new T.Raycaster(), up = new T.Vector3(0, 1, 0);
    const vis = (o) => { while (o) { if (o.visible === false) return false; o = o.parent; } return true; };
    const rows = [];
    for (let z = -40; z <= 60; z += 4) {
      const line = [];
      for (let x = -18; x <= 6; x += 2) {
        const gy = a.terrainHeight(x, z);
        rc.set(new T.Vector3(x, gy + 1.4, z), up);
        rc.near = 0.05; rc.far = 60;
        const h = rc.intersectObjects(g.scene.children, true).find(hit => {
          const o = hit.object;
          if (!o.isMesh && !o.isInstancedMesh) return false;
          if (!vis(o)) return false;
          const m = Array.isArray(o.material) ? o.material[0] : o.material;
          return m && !(m.transparent && m.opacity < 0.35) && m.depthWrite !== false;
        });
        line.push(h ? +(gy + 1.4 + h.distance).toFixed(1) : null);
      }
      rows.push({ z, over: line });
    }
    return rows;
  });
  await page.evaluate(o => fetch('/shot?name=px-hk-awn3.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
