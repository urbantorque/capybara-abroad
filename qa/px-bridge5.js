// CAN A SWIMMER GET OUT OF THE WATER AT THE BRIDGE? — the version that
// actually swims at it.
//
// Third attempt. The first placed the animal inside the bluff (r = 42, dropped
// at d = 34) and read the ejection as a climb. The second could not find water
// because it tested `terrainHeight < waterLevel` and Quay reports terrain 0
// over open water against a waterLevel of -0.5. The third swam the wrong way:
// which of W and S points at the bluff depends on the camera's yaw, and it had
// been assumed. So this one runs BOTH keys and keeps whichever closed the
// distance, which is the only version of this test that cannot lie.
//
// Three targets, because "the deck is unreachable" has to hold at every part of
// the structure that stands in the water: the landfall bluff, a bridge pylon,
// and an approach pier.
async page => {
  const out = { legs: [] };
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4200);
  await page.keyboard.press('Digit3');
  await page.waitForTimeout(7000);
  out.biome = await page.evaluate(() => window.__capy.biome.current);
  const targets = await page.evaluate(() => {
    const g = window.__capy, B = g.quay.bridge;
    const cs = Math.cos(B.yaw), sn = Math.sin(B.yaw);
    const at = u => ({ x: B.x + u * cs, z: B.z - u * sn });
    return [ { name: 'landfall bluff', u: 190, ...at(190) },
             { name: 'pylon', u: 71, ...at(71) },
             { name: 'approach pier', u: 139, ...at(139) } ];
  });
  for (const t of targets) {
    for (const key of ['KeyW', 'KeyS']) {
      // start in genuine open water on the +z side, found by asking the chapter
      const st = await page.evaluate(tt => {
        const g = window.__capy, a = g.quay;
        for (let d = 20; d < 220; d += 2) {
          const x = tt.x, z = tt.z + d;
          if (a.isOverWater(x, z) && a.terrainHeight(x, z) < 1) return { x, z, d };
        }
        return null;
      }, t);
      if (!st) { out.legs.push({ target: t.name, key, err: 'no water found' }); continue; }
      await page.evaluate(s => {
        const g = window.__capy;
        g.capy.body.position.set(s.x, 0.3, s.z);
        g.capy.body.velocity.set(0, 0, 0);
        g.capy.body.aabbNeedsUpdate = true;
        window.__m = -99;
        if (window.__t) clearInterval(window.__t);
        window.__t = setInterval(() => {
          const y = g.capy.position.y; if (y > window.__m) window.__m = y;
        }, 50);
      }, st);
      await page.waitForTimeout(500);
      await page.keyboard.down(key);
      for (let k = 0; k < 12; k++) { await page.waitForTimeout(650); await page.keyboard.press('Space'); }
      await page.keyboard.up(key);
      await page.waitForTimeout(700);
      out.legs.push(await page.evaluate(a => {
        const g = window.__capy, c = g.capy, p = c.position;
        clearInterval(window.__t);
        const d0 = Math.hypot(a.st.x - a.t.x, a.st.z - a.t.z);
        const d1 = Math.hypot(p.x - a.t.x, p.z - a.t.z);
        return { target: a.t.name, key: a.key,
                 startDist: +d0.toFixed(1), endDist: +d1.toFixed(1),
                 closed: +(d0 - d1).toFixed(1),
                 maxY: +window.__m.toFixed(2), y: +p.y.toFixed(2),
                 gnd: !!c.grounded, swim: !!c.swimming };
      }, { st, t, key }));
    }
  }
  out.err = await page.evaluate(() =>
    (window.__capyErr && window.__capyErr.length) ? String(window.__capyErr[0]) : null);
  await page.evaluate(o => fetch('/shot?name=px-bridge5.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
