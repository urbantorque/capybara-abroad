async page => {
  const out = {};
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const yawRot = () => page.evaluate(() => {
    const g = window.__capy, c = g.capy, cam = g.camera.position, p = c.position;
    // where is the camera relative to the nose? nose is +z at rotation 0
    const nx = Math.sin(c.group.rotation.y), nz = Math.cos(c.group.rotation.y);
    const dx = cam.x - p.x, dz = cam.z - p.z, hz = Math.hypot(dx, dz);
    return { yaw: g.input.camYaw, rot: c.group.rotation.y, front: +((dx * nx + dz * nz) / hz).toFixed(2),
             idle: +g.camInfo.idle.toFixed(2), hand: +g.camInfo.hand.toFixed(2) };
  });
  for (const [key, name] of [['Digit1', 'sydney'], ['Minus', 'kowloon'], ['Quote', 'cave']]) {
    await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(4200);
    await page.keyboard.press(key);
    await page.waitForTimeout(5200);
    const r = { biome: await page.evaluate(() => window.__capy.biome.current) };
    // walk forward a moment so the animal has a heading and the rig has settled behind it
    await page.keyboard.down('KeyW'); await page.waitForTimeout(1500); await page.keyboard.up('KeyW');
    await page.waitForTimeout(3000);
    r.settled = await yawRot();
    // turn the camera away by hand
    await page.keyboard.down('KeyZ'); await page.waitForTimeout(700); await page.keyboard.up('KeyZ');
    await page.waitForTimeout(100);
    r.turned = await yawRot();
    await page.keyboard.press('KeyC');
    const t = [];
    for (const ms of [150, 250, 300, 500, 1000, 1500, 2000]) {
      await page.waitForTimeout(ms);
      const s = await yawRot(); s.rel = +wrap(s.yaw - s.rot).toFixed(2); t.push(s);
    }
    r.afterC = t;
    if (name === 'sydney') await page.screenshot({ path: 'qa/px-cam-c-sydney-0p4s.png' });
    out[name] = r;
  }
  // slide retest on a straight run, three chapters that refused or were suspect
  for (const [key, name] of [['Digit7', 'iceland'], ['Digit9', 'drift'], ['Digit5', 'cali'], ['Digit2', 'pasto']]) {
    await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(4200);
    await page.keyboard.press(key);
    await page.waitForTimeout(5200);
    await page.evaluate(() => {
      const g = window.__capy;
      window.__m = { slide: 0, sp: 0, grounded: 0, n: 0 };
      window.__mT = setInterval(() => { const c = g.capy, m = window.__m; m.n++;
        m.sp = Math.max(m.sp, Math.hypot(c.velocity.x, c.velocity.z)); if (c.sliding) m.slide++; if (c.grounded) m.grounded++; }, 30);
    });
    const r = { biome: await page.evaluate(() => window.__capy.biome.current), tries: [] };
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('KeyC'); await page.waitForTimeout(300);
      await page.evaluate(() => { const m = window.__m; m.slide = 0; m.sp = 0; m.grounded = 0; m.n = 0; });
      await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyS'); await page.waitForTimeout(1400);
      await page.keyboard.down('KeyG'); await page.waitForTimeout(600);
      r.tries.push(await page.evaluate(() => ({ ...window.__m })));
      await page.keyboard.up('KeyG'); await page.keyboard.up('KeyS'); await page.keyboard.up('ShiftLeft');
      await page.waitForTimeout(900);
    }
    // Z and X, three times each, in this chapter
    const zx = [];
    for (let i = 0; i < 3; i++) {
      let a = await yawRot(); await page.keyboard.down('KeyZ'); await page.waitForTimeout(600); await page.keyboard.up('KeyZ'); await page.waitForTimeout(100);
      let b = await yawRot(); zx.push({ z: +wrap(b.yaw - a.yaw).toFixed(2) });
      a = b; await page.keyboard.down('KeyX'); await page.waitForTimeout(600); await page.keyboard.up('KeyX'); await page.waitForTimeout(100);
      b = await yawRot(); zx[zx.length - 1].x = +wrap(b.yaw - a.yaw).toFixed(2); zx[zx.length - 1].shot = await page.evaluate(() => +window.__capy.camInfo.shot.toFixed(2));
    }
    r.zx = zx;
    await page.evaluate(() => clearInterval(window.__mT));
    out['slide_' + name] = r;
  }
  // K photo, F todo, Backslash, R hold in Sydney
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4200);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(5200);
  const misc = {};
  await page.keyboard.press('KeyK'); await page.waitForTimeout(400);
  misc.kOn = await page.evaluate(() => ({ photo: !!document.querySelector('.photo, .capyui-photo, [class*="photo"].on, .photo-on'), bodyCls: document.body.className, hudCls: (document.querySelector('.capyui') || {}).className || null }));
  await page.keyboard.press('KeyK'); await page.waitForTimeout(300);
  const p0 = await page.evaluate(() => { const c = window.__capy.capy.position; return [c.x, c.y, c.z]; });
  await page.keyboard.down('KeyR'); await page.waitForTimeout(1700); await page.keyboard.up('KeyR'); await page.waitForTimeout(800);
  const p1 = await page.evaluate(() => { const c = window.__capy.capy.position; return [c.x, c.y, c.z]; });
  misc.rescueMoved = +Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(2);
  const b0 = await page.evaluate(() => window.__capy.biome.current);
  await page.keyboard.press('Backslash'); await page.waitForTimeout(2500);
  misc.backslash = { from: b0, to: await page.evaluate(() => window.__capy.biome.current) };
  out.misc = misc;
  await page.evaluate(o => fetch('/shot?name=px-c.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
