// HOW DID IT GET UP THERE?
//
// px-bridge.js swam the animal at the bridge's landfall bluff, held W and
// jumped, and it ended grounded at y 25.33. A headland collider is an octagon
// of two boxes from y -2 to h with a sheer face, so 25 m of climb over 14 m of
// travel needs an explanation before it is believed. Log the whole ascent: the
// position every 100 ms, what the physics world has directly under it, and
// whether the controller thinks it is climbing.
async page => {
  const out = {};
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4200);
  await page.keyboard.press('Digit3');
  await page.waitForTimeout(7000);
  out.biome = await page.evaluate(() => window.__capy.biome.current);
  out.bluff = await page.evaluate(() => {
    const B = window.__capy.quay.bridge;
    const cs = Math.cos(B.yaw), sn = Math.sin(B.yaw);
    return { x: +(B.x + 190 * cs).toFixed(1), z: +(B.z - 190 * sn).toFixed(1), deck: B.deck };
  });
  await page.evaluate(b => {
    const g = window.__capy;
    g.capy.body.position.set(b.x, 0.4, b.z + 34);
    g.capy.body.velocity.set(0, 0, 0);
    g.capy.body.aabbNeedsUpdate = true;
    window.__tr = [];
    if (window.__trT) clearInterval(window.__trT);
    window.__trT = setInterval(() => {
      const C = g.CANNON, c = g.capy, p = c.position;
      const res = new C.RaycastResult();
      g.world.raycastClosest(new C.Vec3(p.x, p.y, p.z), new C.Vec3(p.x, p.y - 3, p.z),
                             { skipBackfaces: true }, res);
      window.__tr.push({
        at: [+p.x.toFixed(1), +p.y.toFixed(2), +p.z.toFixed(1)],
        under: res.hasHit ? +res.hitPointWorld.y.toFixed(2) : null,
        gap: res.hasHit ? +res.distance.toFixed(2) : null,
        grounded: !!c.grounded, swimming: !!c.swimming,
        climbing: !!c.climbing, clinging: !!c.clinging,
        ground: +g.quay.terrainHeight(p.x, p.z).toFixed(2),
      });
    }, 100);
  }, out.bluff);
  await page.waitForTimeout(400);
  await page.keyboard.down('KeyW');
  for (let k = 0; k < 8; k++) { await page.waitForTimeout(700); await page.keyboard.press('Space'); }
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(600);
  out.trace = await page.evaluate(() => { clearInterval(window.__trT); return window.__tr.slice(); });
  await page.screenshot({ path: 'qa/px-bridge2.png' });
  // ...and the ground the chapter itself reports along the same line
  out.profile = await page.evaluate(b => {
    const g = window.__capy, rows = [];
    for (let d = 40; d >= -10; d -= 4) {
      const x = b.x, z = b.z + d;
      rows.push({ d, terrain: +g.quay.terrainHeight(x, z).toFixed(2),
                  water: !!g.quay.isOverWater(x, z) });
    }
    return rows;
  }, out.bluff);
  await page.evaluate(o => fetch('/shot?name=px-bridge2.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
