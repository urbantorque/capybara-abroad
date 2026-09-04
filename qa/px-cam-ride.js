async page => {
  const out = {};
  const snap = () => page.evaluate(() => {
    const g = window.__capy, c = g.capy, cam = g.camera.position, p = c.position;
    const dx = cam.x - p.x, dy = cam.y - p.y, dz = cam.z - p.z, hz = Math.hypot(dx, dz);
    return { biome: g.biome.current, yaw: +g.input.camYaw.toFixed(2), rot: +c.group.rotation.y.toFixed(2),
             atHelm: !!c.atHelm, sailing: !!g.state.sailing, climb: !!c.climbing, grounded: !!c.grounded,
             capY: +p.y.toFixed(2), camY: +cam.y.toFixed(2), dist: +Math.hypot(dx, dy, dz).toFixed(2),
             up: +dy.toFixed(2), look: +(Math.atan2(dy, hz) * 180 / Math.PI).toFixed(1),
             pitch: +(g.camInfo.pitch * 180 / Math.PI).toFixed(1), sky: +g.camInfo.sky.toFixed(2),
             reach: +g.camInfo.reach.toFixed(1), clear: +g.camInfo.clear.toFixed(2),
             rideBody: !!c.rideBody, err: g.state.lastError || null };
  });
  // ---- 1. the Sydney ferry at the wheel, and standing on its deck ----------
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForTimeout(4200);
  await page.keyboard.press('Digit3'); await page.waitForTimeout(5200);
  await page.evaluate(() => {
    const g = window.__capy, h = g.quay.boat.helm, b = g.capy.body;
    b.position.set(h.x, h.y + 0.4, h.z); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
  });
  await page.waitForTimeout(2500);
  const helm = {};
  helm.onDeck = await snap();
  await page.keyboard.press('KeyE'); await page.waitForTimeout(1500);
  helm.took = await snap();
  await page.keyboard.down('KeyW');
  const s = [];
  for (let i = 0; i < 8; i++) { await page.waitForTimeout(900); s.push(await snap()); }
  helm.sail = s;
  await page.screenshot({ path: 'qa/px-cam-helm-sail.png' });
  // V at the helm (expected: refused by the sail gate), Z at the helm, Q at the helm
  await page.keyboard.down('KeyV'); await page.waitForTimeout(2500); helm.V = await snap(); await page.keyboard.up('KeyV');
  const y0 = await snap(); await page.keyboard.down('KeyZ'); await page.waitForTimeout(900); await page.keyboard.up('KeyZ');
  helm.Z = { before: y0.yaw, after: (await snap()).yaw };
  await page.waitForTimeout(2200); helm.Zback = (await snap()).yaw;
  await page.evaluate(() => { const g = window.__capy; window.__sfx = []; const raw = g.sfx; g.sfx = function (n) { window.__sfx.push(String(n)); return raw.apply(g, arguments); }; });
  await page.keyboard.press('KeyQ'); await page.waitForTimeout(500);
  await page.keyboard.press('Space'); await page.waitForTimeout(500);
  helm.QSpace = await page.evaluate(() => ({ sfx: window.__sfx.slice(), atHelm: !!window.__capy.capy.atHelm }));
  await page.keyboard.up('KeyW');
  await page.keyboard.press('KeyE'); await page.waitForTimeout(1200);
  helm.left = await snap();
  out.helm = helm;

  // ---- 2. the climb in Kowloon: find a hold, face it, hold E ---------------
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForTimeout(4200);
  await page.keyboard.press('Minus'); await page.waitForTimeout(5200);
  const hold = await page.evaluate(() => {
    const g = window.__capy, n = g.biome.current, api = g[n], sp = g.biome.spawnOf(n);
    const gy = (x, z) => api.terrainHeight ? api.terrainHeight(x, z) : 0;
    let found = null;
    outer: for (let r = 3; r <= 60; r += 1.5) {
      for (let a = 0; a < 24; a++) {
        const yaw = a * Math.PI / 12;
        const x = sp.x + r * Math.sin(yaw), z = sp.z + r * Math.cos(yaw);
        // face outward from the spawn, i.e. along +yaw (nose is +z at rotation 0)
        const h = g.capy.climbAt(x, gy(x, z) + 0.6, z, yaw);
        if (h) { found = { x, z, y: gy(x, z), yaw, top: h.top, nx: h.nx, nz: h.nz, r }; break outer; }
      }
    }
    if (found) {
      const b = g.capy.body;
      b.position.set(found.x, found.y + 0.6, found.z); b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      g.capy.group.rotation.y = found.yaw;
    }
    return { biome: n, found };
  });
  const cl = { hold };
  await page.waitForTimeout(1500);
  if (hold.found) {
    // put the camera behind the animal so W walks into the wall
    await page.keyboard.press('KeyC'); await page.waitForTimeout(1200);
    cl.before = await snap();
    await page.keyboard.down('KeyE'); await page.keyboard.down('KeyW');
    const t = [];
    for (let i = 0; i < 6; i++) { await page.waitForTimeout(500); t.push(await snap()); }
    cl.climb = t;
    await page.screenshot({ path: 'qa/px-cam-climb-kowloon.png' });
    await page.keyboard.down('KeyV'); await page.waitForTimeout(2000); cl.climbV = await snap(); await page.keyboard.up('KeyV');
    await page.keyboard.press('Space'); await page.waitForTimeout(700); cl.hopOff = await snap();
    await page.keyboard.up('KeyW'); await page.keyboard.up('KeyE');
    await page.waitForTimeout(1200); cl.after = await snap();
  }
  out.climb = cl;

  // ---- 3. the glide in the Drift (seed skill), deterministic tick loop ----
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForTimeout(4200);
  await page.keyboard.press('Digit9'); await page.waitForTimeout(5200);
  out.glide = await page.evaluate(() => {
    const g = window.__capy, b = g.capy.body, inp = g.input, D = 1 / 60;
    const run = (seed) => {
      b.position.set(-30, 80.4, -108); b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      const rows = [];
      let jumpArmed = false;
      for (let i = 0; i < 60 * 4; i++) {
        g.capy.learn('seed', seed);
        // hold the hop key after 0.5 s of falling
        const hold = i > 30;
        inp.jump = hold; inp.jumpPressed = hold && !jumpArmed; if (hold) jumpArmed = true;
        inp.x = 0; inp.z = 0;
        g.tick(D, false);
        if (i % 30 === 29) {
          const cam = g.camera.position, p = b.position;
          rows.push({ t: +((i + 1) / 60).toFixed(1), y: +p.y.toFixed(1), vy: +b.velocity.y.toFixed(2),
                      camUp: +(cam.y - p.y).toFixed(1), dist: +Math.hypot(cam.x - p.x, cam.y - p.y, cam.z - p.z).toFixed(1),
                      lift: +g.camInfo.lift.toFixed(1), grounded: !!g.capy.grounded });
        }
      }
      inp.jump = false; inp.jumpPressed = false;
      return rows;
    };
    const off = run(false), on = run(true);
    return { biome: g.biome.current, off, on, err: g.state.lastError || null };
  });
  await page.evaluate(o => fetch('/shot?name=px-ride.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
