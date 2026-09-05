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
  // Three repeats of each, interleaved, so a drift in the machine hits both.
  for (let rep = 0; rep < 3; rep++) {
    for (const cand of [{ z: 52, y: 7.1, tag: 'shipped z52' }, { z: 48, y: null, tag: 'z48' }]) {
      await cross('sydney'); await wait(4500);
      await page.evaluate(function (c) {
        const g = window.__capy, sp = g.biome.ANTARCTIC_SPAWN, api = g.antarctic;
        sp.x = 0; sp.z = c.z; sp.yaw = -0.1194;
        sp.y = c.y === null ? api.terrainHeight(0, c.z) + 1.4 : c.y;
        return true;
      }, cand);
      await cross('antarctic'); await wait(9000);
      out.push(await page.evaluate(function (o) {
        const g = window.__capy, ci = g.camInfo, cm = g.camera.position, p = g.capy.position;
        const T = g.THREE;
        const a = new T.Vector3(p.x, p.y + 0.35, p.z).project(g.camera);
        const b = new T.Vector3(p.x, p.y + 1.05, p.z).project(g.camera);
        return { tag: o.tag, rep: o.rep,
                 dist: +Math.hypot(cm.x - p.x, cm.y - p.y, cm.z - p.z).toFixed(2),
                 clear: +ci.clear.toFixed(2),
                 px: Math.round((a.x * 0.5 + 0.5) * 1440), py: Math.round((0.5 - a.y * 0.5) * 900),
                 hPx: Math.round(Math.abs(b.y - a.y) * 0.5 * 900) };
      }, { tag: cand.tag, rep: rep }));
    }
  }
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), { out });
  await page.evaluate(s => fetch('/shot?name=f1-ant3.json', { method: 'POST', body: s }), bl);
}
