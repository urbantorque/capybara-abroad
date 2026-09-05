// IS THE WRECK SOMETHING YOU CAN CLIMB ON?
//
// antGroundSlip says the whalers' beach is "the grippiest thing in the chapter,
// which is exactly why the wreck is somewhere you can climb on". px-claims put
// the animal on the beach and walked it in, and it ended grounded 1.17 m above
// the sand — which is consistent with climbing onto a boat and equally
// consistent with standing on a rock. So: find the wreck in the scene, walk at
// it from four sides, and photograph where the animal ends up.
async page => {
  const out = { legs: [] };
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4200);
  await page.keyboard.press('Comma');
  await page.waitForTimeout(7000);
  out.biome = await page.evaluate(() => window.__capy.biome.current);
  out.wreckMesh = await page.evaluate(() => {
    const g = window.__capy, T = g.THREE, box = new T.Box3(), v = new T.Vector3();
    let best = null;
    g.scene.traverse(o => {
      if (!o.isMesh || o.visible === false) return;
      box.setFromObject(o);
      box.getCenter(v);
      if (Math.hypot(v.x - 122, v.z - 30) > 45) return;
      const h = box.max.y - box.min.y;
      if (h < 0.8 || h > 12) return;
      if (!best || h > best.h) best = { name: o.name || o.type, h: +h.toFixed(2),
        top: +box.max.y.toFixed(2), bot: +box.min.y.toFixed(2),
        at: [+v.x.toFixed(1), +v.z.toFixed(1)],
        size: [+(box.max.x - box.min.x).toFixed(1), +(box.max.z - box.min.z).toFixed(1)] };
    });
    return best;
  });
  const W = out.wreckMesh ? out.wreckMesh.at : [122, 30];
  for (const [side, dx, dz] of [['N', 0, -1], ['S', 0, 1], ['E', 1, 0], ['W', -1, 0]]) {
    for (const key of ['KeyW', 'KeyS', 'KeyA', 'KeyD']) {
      await page.evaluate(a => {
        const g = window.__capy, q = g.antarctic;
        const x = a.W[0] + a.dx * 14, z = a.W[1] + a.dz * 14;
        const h = q.terrainHeight(x, z);
        g.capy.body.position.set(x, (h === h ? h : 0) + 0.6, z);
        g.capy.body.velocity.set(0, 0, 0);
        g.capy.body.aabbNeedsUpdate = true;
        window.__c = -999;
        if (window.__t) clearInterval(window.__t);
        window.__t = setInterval(() => {
          const p = g.capy.position, gy = g.antarctic.terrainHeight(p.x, p.z);
          if (g.capy.grounded && gy === gy) {
            const c = p.y - gy;
            if (c > window.__c) window.__c = c;
          }
        }, 40);
      }, { W, dx, dz });
      await page.waitForTimeout(600);
      await page.keyboard.down(key);
      for (let k = 0; k < 7; k++) { await page.waitForTimeout(600); await page.keyboard.press('Space'); }
      await page.keyboard.up(key);
      await page.waitForTimeout(400);
      out.legs.push(await page.evaluate(a => {
        const g = window.__capy, p = g.capy.position;
        clearInterval(window.__t);
        return { side: a.side, key: a.key,
                 maxGroundedClearance: window.__c < -900 ? null : +window.__c.toFixed(2),
                 end: [+p.x.toFixed(1), +p.y.toFixed(2), +p.z.toFixed(1)],
                 gnd: !!g.capy.grounded };
      }, { side, key }));
    }
  }
  // stand it on the best result and photograph
  const best = out.legs.reduce((a, b) =>
    (b.maxGroundedClearance || -9) > (a && a.maxGroundedClearance || -9) ? b : a, null);
  out.best = best;
  await page.screenshot({ path: 'qa/px-ant-wreck.png' });
  out.err = await page.evaluate(() =>
    (window.__capyErr && window.__capyErr.length) ? String(window.__capyErr[0]) : null);
  await page.evaluate(o => fetch('/shot?name=px-ant-wreck.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
