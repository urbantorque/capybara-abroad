// DO THE ELEVEN NEW HULLS TRAVEL WITH SYDNEY?
//
// game.env is Sydney's and stays RESIDENT when Sydney is detached, which is the
// oldest trap in this project. Bodies added during a chapter's build are claimed
// by main.js's patched world.addBody and detached with it — but that is a thing
// to verify rather than assume, because eleven invisible boats floating in the
// Pantanal is exactly the shape of bug this codebase keeps finding.
async page => {
  const out = { rows: [] };
  for (const [key, name] of [['Digit1', 'sydney'], ['Digit2', 'pasto'], ['Digit3', 'quay']]) {
    await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(4200);
    await page.keyboard.press(key);
    await page.waitForTimeout(6500);
    out.rows.push(await page.evaluate(() => {
      const g = window.__capy, C = g.CANNON;
      const kin = g.world.bodies.filter(b => b.type === C.Body.KINEMATIC);
      // a traffic hull is a 1-shape box with our exact half-extents
      const hulls = kin.filter(b => {
        if (b.shapes.length !== 1) return false;
        const h = b.shapes[0].halfExtents;
        if (!h) return false;
        return (Math.abs(h.z - 3.30) < 0.01 && Math.abs(h.x - 0.80) < 0.01) ||
               (Math.abs(h.z - 6.93) < 0.01 && Math.abs(h.x - 1.68) < 0.01);
      });
      return { biome: g.biome.current, bodies: g.world.bodies.length,
               kinematic: kin.length, trafficHulls: hulls.length,
               err: (window.__capyErr && window.__capyErr.length) ? String(window.__capyErr[0]) : null };
    }));
  }
  await page.evaluate(o => fetch('/shot?name=px-syd-detach.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
