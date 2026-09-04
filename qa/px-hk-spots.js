// KOWLOON'S CAMERA AT SIX PLACES, after camCeil.
// A ceiling is a clamp and a clamp can make a shot worse than the thing it was
// avoiding: the dai pai dong's valance is at 2.42, so the lens is asked to sit
// at 2.07 with the animal's back at 0.7. Look at all of them.
async page => {
  const SPOTS = [['spawn', 0, 34], ['under the canopy', -8.5, 20], ['dai pai dong', 5.2, -24],
                 ['mid road', 0, 0], ['the pier', 0, -56], ['the scaffold', -9.5, 0]];
  const out = { spots: [] };
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4200);
  await page.keyboard.press('Minus');
  await page.waitForTimeout(6500);
  out.biome = await page.evaluate(() => window.__capy.biome.current);
  for (const [name, x, z] of SPOTS) {
    await page.evaluate(p => {
      const g = window.__capy, a = g[g.biome.current];
      const h = a.terrainHeight(p[1], p[2]);
      g.capy.body.position.set(p[1], (h === h ? h : 0) + 0.9, p[2]);
      g.capy.body.velocity.set(0, 0, 0);
      g.capy.body.aabbNeedsUpdate = true;
    }, [name, x, z]);
    await page.waitForTimeout(2200);
    const row = await page.evaluate((nm) => {
      const g = window.__capy, T = g.THREE;
      const c = g.capy, p = c.position, cam = g.camera, cp = cam.position;
      const a = new T.Vector3(p.x, p.y - 0.34, p.z).project(cam);
      const b = new T.Vector3(p.x, p.y + 0.42, p.z).project(cam);
      const rc = new T.Raycaster(), dir = new T.Vector3(p.x - cp.x, p.y - cp.y, p.z - cp.z);
      const d2 = dir.length(); dir.normalize();
      rc.set(cp, dir); rc.near = 0.02; rc.far = Math.max(0.05, d2 - 0.75);
      const vis = (o) => { while (o) { if (o.visible === false) return false; o = o.parent; } return true; };
      const hit = rc.intersectObjects(g.scene.children, true).find(h => {
        const o = h.object;
        if (!o.isMesh && !o.isInstancedMesh) return false;
        if (!vis(o)) return false;
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        return m && !(m.transparent && m.opacity < 0.35) && m.depthWrite !== false;
      });
      return { name: nm, at: [+p.x.toFixed(1), +p.z.toFixed(1)],
               camY: +cp.y.toFixed(2), eyeUp: +(cp.y - p.y).toFixed(2),
               boom: +d2.toFixed(2), clear: +g.camInfo.clear.toFixed(2),
               hFrac: +(Math.abs(b.y - a.y) / 2).toFixed(3),
               screenY: +((a.y + b.y) / 4).toFixed(2),
               onScreen: Math.abs((a.x + b.x) / 4) < 0.5 && Math.abs((a.y + b.y) / 4) < 0.5,
               occluded: !!hit };
    }, name);
    out.spots.push(row);
    await page.screenshot({ path: 'qa/px-hk-' + name.replace(/[^a-z]/g, '') + '.png' });
  }
  out.err = await page.evaluate(() =>
    (window.__capyErr && window.__capyErr.length) ? String(window.__capyErr[0]) : null);
  await page.evaluate(o => fetch('/shot?name=px-hk-spots.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
