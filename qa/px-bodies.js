// HOW MANY BODIES THE HARBOUR HAS, and whether a swimming animal is stopped by
// a moored yacht.
//
// The body count is the differential that proves the colliders exist at all:
// stash the change, build, count; restore, build, count. Thirty-three moored
// hulls is thirty-three static boxes and nothing else changed in the chapter.
//
// The swim is the part that matters to a player. The first attempt held W for
// four seconds from 26 m out, which at swimming speed is ten metres — it never
// reached a hull, so it proved nothing. This one finds a hull by ASKING the
// chapter (navBlocked is built from the static boxes themselves), puts the
// animal three metres upstream of it, and swims into it.
async page => {
  const out = {};
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4200);
  await page.keyboard.press('Digit3');             // 3 = quay
  await page.waitForTimeout(7000);
  out.biome = await page.evaluate(() => window.__capy.biome.current);
  out.bodies = await page.evaluate(() => {
    const g = window.__capy;
    const by = {};
    for (const b of g.world.bodies) {
      const k = b.type === g.CANNON.Body.KINEMATIC ? 'kinematic' : b.mass === 0 ? 'static' : 'dynamic';
      by[k] = (by[k] || 0) + 1;
    }
    return { total: g.world.bodies.length, by };
  });

  // Find a hull in the first mooring field.
  out.found = await page.evaluate(() => {
    // NOT navBlocked: quaySolids skips any box whose top is within solidRISE
    // of the ground, which a hull floating 42 cm over the datum is. That is the
    // right answer for NPC navigation and the wrong instrument for this. Ray
    // the PHYSICS world instead, which is what a swimming animal meets.
    const g = window.__capy, C = g.CANNON;
    const F = { x: -104, z: -172 };
    const y = g[g.biome.current].waterLevel + 0.25;
    for (let r = 4; r < 40; r += 1.5) {
      for (let th = 0; th < 48; th++) {
        const a2 = th / 48 * 6.283;
        const x = F.x + Math.cos(a2) * r, z = F.z + Math.sin(a2) * r;
        const res = new C.RaycastResult();
        g.world.raycastClosest(new C.Vec3(x, y + 6, z), new C.Vec3(x, y - 0.4, z),
                               { skipBackfaces: true }, res);
        if (res.hasHit) return { x: +x.toFixed(2), z: +z.toFixed(2), r,
                                 hitY: +res.hitPointWorld.y.toFixed(2) };
      }
    }
    return null;
  });

  if (out.found) {
    // Put the animal 4 m north of the hull and swim south into it.
    out.swim = await page.evaluate(async (f) => {
      const g = window.__capy;
      g.capy.body.position.set(f.x, 0.4, f.z + 4.5);
      g.capy.body.velocity.set(0, 0, 0);
      g.capy.body.aabbNeedsUpdate = true;
      await new Promise(r => setTimeout(r, 900));
      return { at: [+g.capy.position.x.toFixed(2), +g.capy.position.z.toFixed(2)],
               y: +g.capy.position.y.toFixed(2) };
    }, out.found);
    // Face the hull and hold W. The camera starts behind, so W is away from the
    // camera and the animal was dropped on the camera's far side of the hull.
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(3500);
    await page.keyboard.up('KeyW');
    out.swimEnd = await page.evaluate((f) => {
      const p = window.__capy.capy.position;
      return { at: [+p.x.toFixed(2), +p.z.toFixed(2)], y: +p.y.toFixed(2),
               distToHull: +Math.hypot(p.x - f.x, p.z - f.z).toFixed(2) };
    }, out.found);
    await page.screenshot({ path: 'qa/px-bodies-moor.png' });
  }
  out.err = await page.evaluate(() =>
    (window.__capyErr && window.__capyErr.length) ? String(window.__capyErr[0]) : null);
  await page.evaluate(o => fetch('/shot?name=px-bodies.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
