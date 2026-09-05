// IS THE STONE A JUMP CAN REACH ACTUALLY THERE?
//
// The arch island's lowest drawn stone sits 2.91 m over the floor and a standing
// jump clears 2.53-3.08, so it is reachable. That only matters if the stone is
// DRAWN AND NOT SOLID: bumping your head on a collided leg is a bridge working,
// and passing through a voussoir is not.
//
// So the same grid twice — the drawn surface over each point, and the physics
// surface over it — and the gap between them is the answer.
async page => {
  const out = {};
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4200);
  await page.keyboard.press('Digit9');
  await page.waitForTimeout(7000);
  out.biome = await page.evaluate(() => window.__capy.biome.current);
  out.grid = await page.evaluate(() => {
    const g = window.__capy, T = g.THREE, C = g.CANNON;
    const rc = new T.Raycaster(), up = new T.Vector3(0, 1, 0);
    const vis = o => { while (o) { if (o.visible === false) return false; o = o.parent; } return true; };
    const rows = [];
    for (let u = -5; u <= 5; u += 0.5) {
      for (let v = -3; v <= 3; v += 0.5) {
        const x = 5 + u, z = -106 + v;
        const gy = g.drift.terrainHeight(x, z);
        if (!(gy > 40)) continue;
        rc.set(new T.Vector3(x, gy + 0.4, z), up);
        rc.near = 0.05; rc.far = 25;
        const h = rc.intersectObjects(g.scene.children, true).find(hit => {
          const o = hit.object;
          if (!o.isMesh && !o.isInstancedMesh) return false;
          if (!vis(o)) return false;
          const m = Array.isArray(o.material) ? o.material[0] : o.material;
          return m && !(m.transparent && m.opacity < 0.35) && m.depthWrite !== false;
        });
        if (!h) continue;
        const drawn = 0.4 + h.distance;
        // the physics surface over the same point, searched well past the drawn one
        const res = new C.RaycastResult();
        g.world.raycastClosest(new C.Vec3(x, gy + 0.4, z), new C.Vec3(x, gy + 0.4 + 25, z),
                               { skipBackfaces: true }, res);
        const solid = res.hasHit ? +(res.hitPointWorld.y - gy).toFixed(2) : null;
        rows.push({ u: +u.toFixed(1), v: +v.toFixed(1), drawn: +drawn.toFixed(2), solid,
                    // drawn stone a 3.08 m jump reaches, with nothing solid at or below it
                    bare: drawn <= 3.08 && (solid === null || solid > drawn + 0.25) });
      }
    }
    return rows;
  });
  out.bare = out.grid.filter(r => r.bare);
  out.lowestDrawn = out.grid.reduce((a, b) => (!a || b.drawn < a.drawn) ? b : a, null);
  out.err = await page.evaluate(() =>
    (window.__capyErr && window.__capyErr.length) ? String(window.__capyErr[0]) : null);
  await page.evaluate(o => fetch('/shot?name=px-drift-arch.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
