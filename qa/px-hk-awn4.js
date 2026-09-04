// THE LOWEST THING OVER THE WEST PAVEMENT, on a 1 m grid.
// A single 4.8 ceiling left the frame at (-8.5, 20) as one red awning: the
// strip is not one height. camCeil takes a number, so the number has to be the
// LOWEST cover across the strip, not the commonest.
async page => {
  const out = {};
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4200);
  await page.keyboard.press('Minus');
  await page.waitForTimeout(6500);
  out.biome = await page.evaluate(() => window.__capy.biome.current);
  out.strip = await page.evaluate(() => {
    const g = window.__capy, T = g.THREE, a = g[g.biome.current];
    const rc = new T.Raycaster(), up = new T.Vector3(0, 1, 0);
    const vis = (o) => { while (o) { if (o.visible === false) return false; o = o.parent; } return true; };
    let min = 1e9, minAt = null, n = 0, covered = 0;
    const hist = {};
    for (let x = -11; x <= -6.5; x += 0.5) {
      for (let z = -44; z <= 62; z += 1) {
        const gy = a.terrainHeight(x, z);
        rc.set(new T.Vector3(x, gy + 1.1, z), up);
        rc.near = 0.05; rc.far = 40;
        const h = rc.intersectObjects(g.scene.children, true).find(hit => {
          const o = hit.object;
          if (!o.isMesh && !o.isInstancedMesh) return false;
          if (!vis(o)) return false;
          const m = Array.isArray(o.material) ? o.material[0] : o.material;
          return m && !(m.transparent && m.opacity < 0.35) && m.depthWrite !== false;
        });
        n++;
        if (!h) continue;
        covered++;
        const y = gy + 1.1 + h.distance;
        const b = Math.floor(y * 2) / 2;
        hist[b] = (hist[b] || 0) + 1;
        if (y < min) { min = y; minAt = [x, z]; }
      }
    }
    return { cells: n, covered, min: +min.toFixed(2), minAt, hist };
  });
  await page.evaluate(o => fetch('/shot?name=px-hk-awn4.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
