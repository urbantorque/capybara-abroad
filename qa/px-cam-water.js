async page => {
  const out = {};
  const snap = () => page.evaluate(() => {
    const g = window.__capy, c = g.capy, cam = g.camera.position, p = c.position;
    const dx = cam.x - p.x, dy = cam.y - p.y, dz = cam.z - p.z, hz = Math.hypot(dx, dz);
    const api = g[g.biome.current] || g.env;
    let wy = null;
    try { wy = api && api.waterHeightAt ? +api.waterHeightAt(cam.x, cam.z).toFixed(2) : null; } catch (e) {}
    return { biome: g.biome.current, swim: !!c.swimming, dive: !!c.diving, depth: +(c.depth || 0).toFixed(2),
             capY: +p.y.toFixed(2), camY: +cam.y.toFixed(2), waterAtCam: wy,
             dist: +Math.hypot(dx, dy, dz).toFixed(2), look: +(Math.atan2(dy, hz) * 180 / Math.PI).toFixed(1),
             pitch: +(g.camInfo.pitch * 180 / Math.PI).toFixed(1), sky: +g.camInfo.sky.toFixed(2),
             rig: +g.camInfo.rig.toFixed(2), clear: +g.camInfo.clear.toFixed(2), floor: +g.camInfo.floor.toFixed(2),
             lift: +g.camInfo.lift.toFixed(2), err: g.state.lastError || null };
  });
  // ---- deep water: Palawan and Manly ---------------------------------------
  for (const [key, name] of [['Equal', 'palawan'], ['BracketRight', 'manly']]) {
    await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(4200);
    await page.keyboard.press(key);
    await page.waitForTimeout(5200);
    const spot = await page.evaluate(() => {
      const g = window.__capy, n = g.biome.current, api = g[n];
      const sp = g.biome.spawnOf(n);
      let best = null;
      for (let r = 6; r <= 120; r += 4) {
        for (let a = 0; a < 16; a++) {
          const x = sp.x + r * Math.cos(a * Math.PI / 8), z = sp.z + r * Math.sin(a * Math.PI / 8);
          if (!(api.isOverWater && api.isOverWater(x, z))) continue;
          const th = api.terrainHeight ? api.terrainHeight(x, z) : 0;
          const wy = api.waterHeightAt ? api.waterHeightAt(x, z) : -0.5;
          const d = wy - th;
          if (d >= 3.0 && (!best || d > best.d)) best = { x, z, d, wy, th, r };
        }
        if (best && best.d > 4) break;
      }
      if (best) {
        const b = g.capy.body;
        b.position.set(best.x, best.wy + 0.3, best.z); b.velocity.set(0, 0, 0);
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      }
      return { biome: n, best };
    });
    const r = { spot };
    await page.waitForTimeout(2500);
    r.surface = await snap();
    await page.keyboard.down('KeyE'); await page.waitForTimeout(3000);
    r.diving = await snap();
    await page.screenshot({ path: 'qa/px-cam-under-' + name + '.png' });
    // V while under
    await page.keyboard.down('KeyV'); await page.waitForTimeout(2500);
    r.divingV = await snap();
    await page.screenshot({ path: 'qa/px-cam-under-' + name + '-V.png' });
    await page.keyboard.up('KeyV');
    // Space while under (hop?) and Z yaw
    await page.keyboard.press('Space'); await page.waitForTimeout(400);
    r.divingSpace = await snap();
    await page.keyboard.up('KeyE'); await page.waitForTimeout(3000);
    r.surfaced = await snap();
    // V while swimming at the surface
    await page.keyboard.down('KeyV'); await page.waitForTimeout(2500);
    r.swimV = await snap();
    await page.keyboard.up('KeyV');
    out[name] = r;
  }
  // ---- V under a sky feature: Iceland (aurora), Goreme (balloons), and the cave roof
  for (const [key, name] of [['Digit7', 'iceland'], ['BracketLeft', 'goreme'], ['Quote', 'cave'], ['Minus', 'kowloon']]) {
    await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(4200);
    await page.keyboard.press(key);
    await page.waitForTimeout(5200);
    await page.waitForTimeout(1500);
    const r = {};
    r.rest = await snap();
    await page.screenshot({ path: 'qa/px-cam-v-' + name + '-0.png' });
    await page.keyboard.down('KeyV'); await page.waitForTimeout(3000);
    r.v = await snap();
    await page.screenshot({ path: 'qa/px-cam-v-' + name + '-1.png' });
    // V while walking
    await page.keyboard.down('KeyW'); await page.waitForTimeout(1500);
    r.vWalk = await snap();
    await page.keyboard.up('KeyW');
    await page.keyboard.up('KeyV'); await page.waitForTimeout(2500);
    r.after = await snap();
    if (name === 'cave') {
      r.ceil = await page.evaluate(() => { const g = window.__capy, c = g.camera.position; return +g.cave.camCeil(c.x, c.z).toFixed(2); });
    }
    out[name] = r;
  }
  await page.evaluate(o => fetch('/shot?name=px-water.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
