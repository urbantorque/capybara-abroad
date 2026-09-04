async page => {
  const KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7',
                'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal', 'BracketLeft',
                'BracketRight', 'Semicolon', 'Quote', 'Comma', 'Period', 'Slash'];
  const FIRST = 0, LAST = 9;
  const rows = [];
  const snap = () => page.evaluate(() => {
    const g = window.__capy, c = g.capy, cam = g.camera.position, p = c.position;
    const dx = cam.x - p.x, dy = cam.y - p.y, dz = cam.z - p.z;
    const hz = Math.hypot(dx, dz);
    return { yaw: +g.input.camYaw.toFixed(3), rot: +c.group.rotation.y.toFixed(3),
             pitch: +(g.camInfo.pitch * 180 / Math.PI).toFixed(1),
             look: +(Math.atan2(dy, hz) * 180 / Math.PI).toFixed(1),
             sky: +g.camInfo.sky.toFixed(2), reach: +g.camInfo.reach.toFixed(1),
             clear: +g.camInfo.clear.toFixed(2), dy: +dy.toFixed(2),
             dist: +Math.hypot(dx, dy, dz).toFixed(2),
             sp: +Math.hypot(c.velocity.x, c.velocity.z).toFixed(2),
             grounded: c.grounded, swim: !!c.swimming, held: !!c.heldProp,
             climb: !!c.climbing, dive: !!c.diving,
             sfx: window.__px.sfx.slice(-4), err: g.state.lastError || null };
  });
  const maxes = () => page.evaluate(() => { const m = window.__px.max; m.sfx = window.__px.sfx.slice(-4); return m; });
  const reset = () => page.evaluate(() => { window.__px.max = {}; window.__px.sfx.length = 0; });
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  for (let k = FIRST; k <= LAST; k++) {
    await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(4200);
    await page.keyboard.press(KEYS[k]);
    await page.waitForTimeout(5200);
    await page.evaluate(() => {
      const g = window.__capy;
      window.__px = { biome: g.biome.current, sfx: [], max: {} };
      const raw = g.sfx;
      g.sfx = function (n) { window.__px.sfx.push(String(n)); return raw.apply(g, arguments); };
      window.__pxT = setInterval(() => {
        const c = g.capy, m = window.__px.max, v = c.velocity;
        const sp = Math.hypot(v.x, v.z);
        m.sp = Math.max(m.sp || 0, sp);
        m.vy = Math.max(m.vy === undefined ? -99 : m.vy, v.y);
        if (c.sliding) m.slide = 1;
        if (c.climbing) m.climb = 1;
        if (c.diving) m.dive = 1;
        if (c.swimming) m.swim = 1;
        if (c.heldProp) m.held = 1;
        m.sky = Math.max(m.sky || 0, g.camInfo.sky);
        m.clearMin = Math.min(m.clearMin === undefined ? 1 : m.clearMin, g.camInfo.clear);
      }, 30);
    });
    const row = { k: k + 1, biome: await page.evaluate(() => window.__capy.biome.current) };
    // settle
    await page.waitForTimeout(800);
    // HOP
    await reset(); await page.keyboard.press('Space'); await page.waitForTimeout(600);
    row.hop = await maxes();
    // WALK
    await reset(); await page.keyboard.down('KeyW'); await page.waitForTimeout(1200);
    row.walk = (await maxes()).sp;
    // RUN + SLIDE while running
    await reset(); await page.keyboard.down('ShiftLeft'); await page.waitForTimeout(1500);
    row.run = (await maxes()).sp;
    await reset(); await page.keyboard.down('KeyG'); await page.waitForTimeout(700);
    row.slide = await maxes();
    await page.keyboard.up('KeyG'); await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW');
    await page.waitForTimeout(600);
    // WHEEK
    await reset(); await page.keyboard.press('KeyQ'); await page.waitForTimeout(450);
    row.wheek = (await maxes()).sfx;
    // GRAB (E) in the open — records what changed
    await reset(); await page.keyboard.press('KeyE'); await page.waitForTimeout(500);
    row.grab = await maxes();
    // Z / X yaw
    let s0 = await snap(); await page.keyboard.down('KeyZ'); await page.waitForTimeout(800); await page.keyboard.up('KeyZ');
    await page.waitForTimeout(150); let s1 = await snap();
    row.z = +wrap(s1.yaw - s0.yaw).toFixed(2);
    s0 = s1; await page.keyboard.down('KeyX'); await page.waitForTimeout(800); await page.keyboard.up('KeyX');
    await page.waitForTimeout(150); s1 = await snap();
    row.x = +wrap(s1.yaw - s0.yaw).toFixed(2);
    // C recentre: yaw is bearing animal->camera, behind = rot + PI
    await page.keyboard.down('KeyZ'); await page.waitForTimeout(700); await page.keyboard.up('KeyZ');
    await page.waitForTimeout(100); s0 = await snap();
    await page.keyboard.press('KeyC'); await page.waitForTimeout(1500); s1 = await snap();
    row.c = { before: +wrap(s0.yaw - (s0.rot + Math.PI)).toFixed(2), after: +wrap(s1.yaw - (s1.rot + Math.PI)).toFixed(2) };
    // V eye raise
    await page.waitForTimeout(1500); s0 = await snap();
    await page.keyboard.down('KeyV'); await page.waitForTimeout(2500); s1 = await snap();
    await page.keyboard.up('KeyV'); await page.waitForTimeout(2500); const s2 = await snap();
    row.v = { pitch: [s0.pitch, s1.pitch, s2.pitch], look: [s0.look, s1.look, s2.look],
              sky: [s0.sky, s1.sky, s2.sky], dy: [s0.dy, s1.dy, s2.dy], dist: [s0.dist, s1.dist, s2.dist],
              clear: [s0.clear, s1.clear, s2.clear] };
    // P bare HUD
    await page.keyboard.press('KeyP'); await page.waitForTimeout(200);
    row.p = await page.evaluate(() => !!document.querySelector('.bare'));
    await page.keyboard.press('KeyP'); await page.waitForTimeout(200);
    row.state = await snap();
    await page.evaluate(() => clearInterval(window.__pxT));
    rows.push(row);
  }
  await page.evaluate(o => fetch('/shot?name=px-controls-a.json', {
    method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), rows);
}
