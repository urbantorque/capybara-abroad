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
  const out = [];
  const Z = [44, 46, 48, 50, 52];
  for (let i = 0; i < Z.length; i++) {
    await cross('sydney'); await wait(4500);
    await page.evaluate(function (z) {
      const g = window.__capy, sp = g.biome.ANTARCTIC_SPAWN, api = g.antarctic;
      sp.x = 0; sp.z = z; sp.yaw = -0.1194;
      sp.y = api.terrainHeight(0, z) + 1.4;
      return true;
    }, Z[i]);
    await cross('antarctic'); await wait(9000);
    out.push(await page.evaluate(function (z) {
      const g = window.__capy, ci = g.camInfo, cm = g.camera.position, p = g.capy.position;
      // Where the animal lands on screen, and how big it is there.
      const T = g.THREE;
      const a = new T.Vector3(p.x, p.y + 0.35, p.z).project(g.camera);
      const b = new T.Vector3(p.x, p.y + 1.05, p.z).project(g.camera);
      return { z: z, dist: +Math.hypot(cm.x - p.x, cm.y - p.y, cm.z - p.z).toFixed(2),
               clear: +ci.clear.toFixed(2), reach: +ci.reach.toFixed(2),
               capy: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)],
               ndcX: +a.x.toFixed(3), ndcY: +a.y.toFixed(3),
               px: Math.round((a.x * 0.5 + 0.5) * 1440), py: Math.round((0.5 - a.y * 0.5) * 900),
               hPx: Math.round(Math.abs(b.y - a.y) * 0.5 * 900),
               onScreen: Math.abs(a.x) < 1 && Math.abs(a.y) < 1 && a.z < 1 };
    }, Z[i]));
    await page.screenshot({ path: 'qa/F1A2-ant-z' + Z[i] + '.png' });
  }
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), { out });
  await page.evaluate(s => fetch('/shot?name=f1-ant2.json', { method: 'POST', body: s }), bl);
}
