async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await wait(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await wait(6500);
  await page.keyboard.press('Digit1');
  await wait(3500);
  const cross = n => page.evaluate(function (n) {
    const g = window.__capy;
    try { g.hud.cross(n); } catch (e) { g.biome.switchTo(n); }
    return true;
  }, n);

  const out = { profile: null, tries: [] };

  // The terrain along the arrival bearing, from the spawn outward.
  await cross('antarctic'); await wait(8000);
  out.profile = await page.evaluate(() => {
    const g = window.__capy, api = g.antarctic, sp = g.biome.ANTARCTIC_SPAWN;
    const rows = [];
    const sy = Math.sin(sp.yaw), cy = Math.cos(sp.yaw);
    for (let d = 0; d <= 18; d += 2) {
      const x = sp.x + sy * d, z = sp.z + cy * d;
      rows.push({ d: d, x: +x.toFixed(1), z: +z.toFixed(1),
                  h: +api.terrainHeight(x, z).toFixed(2) });
    }
    return { spawn: { x: sp.x, y: sp.y, z: sp.z, yaw: sp.yaw },
             hAtSpawn: +api.terrainHeight(sp.x, sp.z).toFixed(2), back: rows };
  });

  const CAND = [
    { tag: 'as shipped' },
    { tag: 'z 46', z: 46 },
    { tag: 'z 42', z: 42 },
    { tag: 'z 58', z: 58 },
    { tag: 'x -9', x: -9 },
    { tag: 'x  9', x: 9 },
    { tag: 'yaw +0.9', yaw: -0.1194 + 0.9 },
    { tag: 'yaw -0.9', yaw: -0.1194 - 0.9 },
  ];
  for (let i = 0; i < CAND.length; i++) {
    const c = CAND[i];
    await cross('sydney'); await wait(4500);
    await page.evaluate(function (c) {
      const g = window.__capy, sp = g.biome.ANTARCTIC_SPAWN;
      if (!g.__antOrig) g.__antOrig = { x: sp.x, y: sp.y, z: sp.z, yaw: sp.yaw };
      const o = g.__antOrig;
      sp.x = c.x === undefined ? o.x : c.x;
      sp.z = c.z === undefined ? o.z : c.z;
      sp.yaw = c.yaw === undefined ? o.yaw : c.yaw;
      // Sit the spawn on its own ground, whatever we just moved it to.
      const api = g.antarctic;
      if (api && api.terrainHeight) sp.y = api.terrainHeight(sp.x, sp.z) + 1.1;
      return true;
    }, c);
    await cross('antarctic'); await wait(9000);
    const r = await page.evaluate(function (tag) {
      const g = window.__capy, ci = g.camInfo, cm = g.camera.position, p = g.capy.position;
      return { tag: tag,
               dist: +Math.hypot(cm.x - p.x, cm.y - p.y, cm.z - p.z).toFixed(2),
               reach: +ci.reach.toFixed(2), clear: +ci.clear.toFixed(2),
               capy: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)],
               cam: [+cm.x.toFixed(1), +cm.y.toFixed(1), +cm.z.toFixed(1)] };
    }, c.tag);
    out.tries.push(r);
    await page.screenshot({ path: 'qa/F1A-ant-' + i + '.png' });
  }
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=f1-ant.json', { method: 'POST', body: s }), bl);
}
