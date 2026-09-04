// THE SCAFFOLD CLIMB, AGAINST THE NEW CEILING.
// hkSCAF stands at x = -hkFACE, which is inside the covered strip camCeil now
// clamps to 3.15. If the ceiling did not stop at the boards, climbing to 34 m
// would hold the lens at 3.15 and the frame would be the pavement. Put the
// animal at a ladder of heights up the scaffold and read the camera at each.
async page => {
  const out = { rungs: [] };
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4200);
  await page.keyboard.press('Minus');
  await page.waitForTimeout(6500);
  out.biome = await page.evaluate(() => window.__capy.biome.current);
  for (const y of [0.4, 2.0, 3.4, 6, 12, 20, 30, 34.9]) {
    // PINNED, not dropped. The first version set the position once and waited
    // 1.4 s, and the animal simply fell: every rung above 12 read capY 0.34 and
    // a camera still damping down from where it had been. Hold it there.
    await page.evaluate(h => {
      const g = window.__capy;
      if (window.__pin) clearInterval(window.__pin);
      window.__pin = setInterval(() => {
        g.capy.body.position.set(-10.5 + 1.2, h, 0);
        g.capy.body.velocity.set(0, 0, 0);
        g.capy.body.aabbNeedsUpdate = true;
      }, 16);
    }, y);
    await page.waitForTimeout(1600);
    out.rungs.push(await page.evaluate((h) => {
      const g = window.__capy, T = g.THREE;
      const c = g.capy, p = c.position, cam = g.camera, cp = cam.position;
      const a = new T.Vector3(p.x, p.y - 0.34, p.z).project(cam);
      const b = new T.Vector3(p.x, p.y + 0.42, p.z).project(cam);
      return { asked: h, capY: +p.y.toFixed(2), camY: +cp.y.toFixed(2),
               eyeUp: +(cp.y - p.y).toFixed(2),
               boom: +Math.hypot(cp.x - p.x, cp.y - p.y, cp.z - p.z).toFixed(2),
               hFrac: +(Math.abs(b.y - a.y) / 2).toFixed(3),
               onScreen: Math.abs((a.x + b.x) / 4) < 0.5 && Math.abs((a.y + b.y) / 4) < 0.5 };
    }, y));
  }
  await page.screenshot({ path: 'qa/px-hk-climb.png' });
  await page.evaluate(() => { if (window.__pin) clearInterval(window.__pin); });
  out.err = await page.evaluate(() =>
    (window.__capyErr && window.__capyErr.length) ? String(window.__capyErr[0]) : null);
  await page.evaluate(o => fetch('/shot?name=px-hk-climb.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
