// CAN A SWIMMER GET OUT OF THE WATER ONTO THE BRIDGE'S LANDFALL BLUFF?
//
// The first two attempts at this were both invalid, in the way this project
// keeps paying for: px-bridge.js dropped the animal at (bluff.x, 0.4, bluff.z
// + 34) and called the result a climb, and px-bridge2.js's trace shows why that
// was nonsense — the FIRST sample already reads y 25.34, grounded, terrain 25.
// The bluff's radius is 42, so 34 m out is INSIDE it: the animal was placed in
// the rock and the solver ejected it out of the top.
//
// So: find genuine open water by asking the chapter (isOverWater AND terrain
// under the waterline), start there, swim at the bluff and log the ascent. If
// the face is sheer this tops out at the waterline and the deck 25 m above is
// unreachable; if there is a way up, it will show as a staircase in `under`.
async page => {
  const out = {};
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4200);
  await page.keyboard.press('Digit3');
  await page.waitForTimeout(7000);
  out.biome = await page.evaluate(() => window.__capy.biome.current);
  out.probe = await page.evaluate(() => {
    const g = window.__capy, B = g.quay.bridge, a = g.quay;
    const cs = Math.cos(B.yaw), sn = Math.sin(B.yaw);
    const bx = B.x + 190 * cs, bz = B.z - 190 * sn;
    // walk outward along +z until the chapter says water AND the ground is
    // under the waterline — a headland reports terrain 25 with isOverWater
    // false, so both tests are needed.
    // NOT `terrain < waterLevel`: Quay reports terrainHeight 0 over open water
    // against a waterLevel of -0.5, so that test finds nothing anywhere and the
    // first run of this probe returned start:null. isOverWater is the authority;
    // the terrain test only has to reject the headland's own 25 m plateau.
    let start = null;
    for (let d = 30; d < 200; d += 2) {
      const x = bx, z = bz + d;
      const t = a.terrainHeight(x, z);
      if (a.isOverWater(x, z) && t < 1) { start = { x, z, d, terrain: +t.toFixed(2) }; break; }
    }
    return { bluff: { x: +bx.toFixed(1), z: +bz.toFixed(1) }, start };
  });
  if (!out.probe.start) {
    await page.evaluate(o => fetch('/shot?name=px-bridge3.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
    return;
  }
  await page.evaluate(p => {
    const g = window.__capy;
    g.capy.body.position.set(p.start.x, 0.3, p.start.z);
    g.capy.body.velocity.set(0, 0, 0);
    g.capy.body.aabbNeedsUpdate = true;
    window.__tr = [];
    window.__max = -99;
    if (window.__trT) clearInterval(window.__trT);
    window.__trT = setInterval(() => {
      const C = g.CANNON, c = g.capy, pp = c.position;
      if (pp.y > window.__max) window.__max = pp.y;
      const res = new C.RaycastResult();
      g.world.raycastClosest(new C.Vec3(pp.x, pp.y, pp.z), new C.Vec3(pp.x, pp.y - 3, pp.z),
                             { skipBackfaces: true }, res);
      window.__tr.push({ at: [+pp.x.toFixed(1), +pp.y.toFixed(2), +pp.z.toFixed(1)],
                         under: res.hasHit ? +res.hitPointWorld.y.toFixed(2) : null,
                         gnd: !!c.grounded, swim: !!c.swimming, cling: !!c.clinging });
    }, 100);
  }, out.probe);
  await page.waitForTimeout(500);
  out.startedSwimming = await page.evaluate(() => !!window.__capy.capy.swimming);
  // Face the bluff and swim at it. S is toward the camera; the camera starts
  // behind, so hold S to go back toward -z... use both and take the better.
  await page.keyboard.down('KeyS');
  for (let k = 0; k < 14; k++) { await page.waitForTimeout(700); await page.keyboard.press('Space'); }
  await page.keyboard.up('KeyS');
  await page.waitForTimeout(800);
  out.trace = await page.evaluate(() => { clearInterval(window.__trT); return window.__tr.slice(); });
  out.maxY = await page.evaluate(() => +window.__max.toFixed(2));
  out.end = await page.evaluate(() => {
    const c = window.__capy.capy, p = c.position;
    return { at: [+p.x.toFixed(1), +p.y.toFixed(2), +p.z.toFixed(1)],
             gnd: !!c.grounded, swim: !!c.swimming };
  });
  await page.screenshot({ path: 'qa/px-bridge3.png' });
  out.err = await page.evaluate(() =>
    (window.__capyErr && window.__capyErr.length) ? String(window.__capyErr[0]) : null);
  await page.evaluate(o => fetch('/shot?name=px-bridge3.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
