async page => {
  await page.reload();
  await page.evaluate(() => {
    if (window.__err) return;
    window.__err = [];
    const e0 = console.error;
    console.error = function () { window.__err.push([].slice.call(arguments).join(' ')); e0.apply(console, arguments); };
    window.addEventListener('error', ev => window.__err.push('WINDOW ' + (ev.message || ev.error)));
  });
  await page.waitForFunction(() => window.__capy && window.__capy.biome, null, { timeout: 30000 });
  await page.keyboard.press('Digit1');
  await page.waitForFunction(() => window.__capy.state.started, null, { timeout: 20000 });
  await page.waitForTimeout(1500);

  const out = { got: [], errors: [] };
  const put = (x, y, z, vy) => page.evaluate(a => {
    const g = window.__capy;
    g.capy.body.position.set(a[0], a[1], a[2]);
    g.capy.body.velocity.set(0, a[3] || 0, 0);
  }, [x, y, z, vy]);
  const done = () => page.evaluate(() => [].slice.call(document.querySelectorAll('.done'))
    .map(e => (e.textContent || '').trim()));
  const go = async n => {
    await page.evaluate(b => window.__capy.biome.switchTo(b), n);
    await page.waitForTimeout(2200);
  };
  const hold = async (x, y, z, secs, vy) => {
    for (let i = 0; i < Math.ceil(secs / 0.25); i++) { await put(x, y, z, vy); await page.waitForTimeout(250); }
  };

  // ---- KYOTO: dry-crossing --------------------------------------------------
  await go('kyoto');
  const st = await page.evaluate(() => {
    const k = window.__capy.kyoto;
    return [k.stones.x, k.waterLevel, k.stones.z, k.pond.x, k.pond.z];
  });
  await hold(st[0], st[1] + 1.0, st[2], 1.2);
  await hold(30, st[1] + 3.2, -12, 1.2);
  out.got.push(['kyoto', await done()]);

  // ---- CALI: puente-ortiz ---------------------------------------------------
  await go('cali');
  const cb = await page.evaluate(() => [window.__capy.cali.bridge.x, window.__capy.cali.bridge.z]);
  await hold(cb[0], -1.2, cb[1] + 6, 1.0);
  await hold(cb[0], -1.2, cb[1] - 6, 1.2);
  out.got.push(['cali', await done()]);

  // ---- RIO: calcadao + kiosk ------------------------------------------------
  await go('rio');
  const rz = await page.evaluate(() => window.__capy.rio.calcadao.z);
  await hold(-70, 1.2, rz, 1.0);
  await hold(70, 1.2, rz, 1.2);
  const kk = await page.evaluate(() => [window.__capy.rio.kiosk.x, window.__capy.rio.kiosk.z]);
  await hold(kk[0], 2.6, kk[1], 1.0);
  for (let i = 0; i < 6; i++) { await put(kk[0], 2.6, kk[1]); await page.keyboard.press('KeyE'); await page.waitForTimeout(180); }
  out.got.push(['rio', await done()]);

  // ---- ICELAND: snowcat -----------------------------------------------------
  await go('iceland');
  for (let i = 0; i < 44; i++) {
    await page.evaluate(() => {
      const g = window.__capy;
      const s = g.iceland.snowcat();
      g.capy.body.position.set(s.x, s.y + 1.5, s.z);
      g.capy.body.velocity.set(0, 0, 0);
    });
    await page.waitForTimeout(250);
  }
  out.got.push(['iceland', await done()]);

  // ---- MARRAKECH: date-palm -------------------------------------------------
  await go('sahara');
  const dp = await page.evaluate(() => [window.__capy.sahara.datePalm.x, window.__capy.sahara.datePalm.z,
                                        window.__capy.sahara.terrainHeight(window.__capy.sahara.datePalm.x, window.__capy.sahara.datePalm.z)]);
  for (let i = 0; i < 8; i++) { await put(dp[0] + 1.6, dp[2] + 0.6, dp[1]); await page.keyboard.press('KeyE'); await page.waitForTimeout(200); }
  out.got.push(['sahara', await done()]);

  // ---- DRIFT: the-underside, then weathervane -------------------------------
  await go('drift');
  await put(30, 28, 34);
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(400);
    const d = await done();
    if (d.join('|').indexOf('hand you back') >= 0) break;
  }
  const vn = await page.evaluate(() => [window.__capy.drift.vane.x, window.__capy.drift.vane.z]);
  await hold(vn[0], 31.0, vn[1], 24);
  out.got.push(['drift', await done()]);

  // ---- VENICE: the-well + the-calli -----------------------------------------
  await go('venice');
  const vc = await page.evaluate(() => [window.__capy.venice.campo.x, window.__capy.venice.campo.z,
                                        window.__capy.venice.calli.x, window.__capy.venice.calli.z]);
  await hold(-34, 2.0, vc[3], 1.2);
  await hold(-74, 2.0, vc[3], 1.4);
  await hold(vc[0], 2.9, vc[1], 1.0);
  for (let i = 0; i < 8; i++) { await put(vc[0], 2.9, vc[1]); await page.keyboard.press('KeyE'); await page.waitForTimeout(180); }
  out.got.push(['venice', await done()]);

  // ---- HONG KONG: harbour-swim + ferry-horn ---------------------------------
  await go('kowloon');
  await hold(0, -0.2, -100, 3.5);
  for (let i = 0; i < 40; i++) {
    const on = await page.evaluate(() => {
      const g = window.__capy;
      const f = g.kowloon.ferry();
      g.capy.body.position.set(f.x, f.y + 1.6, f.z);
      g.capy.body.velocity.set(0, 0, 0);
      return f.z;
    });
    await page.keyboard.press('KeyQ');
    await page.waitForTimeout(220);
    if (i > 6 && (await done()).join('|').indexOf('horn') >= 0) break;
    void on;
  }
  out.got.push(['kowloon', await done()]);

  // ---- PALAWAN: jetty-jump + beach-fire -------------------------------------
  await go('palawan');
  const pj = await page.evaluate(() => [window.__capy.palawan.jetty.x, window.__capy.palawan.jetty.z,
                                        window.__capy.palawan.fire.x, window.__capy.palawan.fire.z]);
  await hold(pj[0], 1.6, pj[1] + 6, 1.0);
  await hold(pj[0], 1.9, pj[1] - 3, 1.0);
  // get thoroughly wet, then sit on the fire
  await hold(0, -0.4, 10, 4.0);
  await hold(pj[2], 2.0, pj[3], 2.0);
  out.got.push(['palawan', await done()]);

  // ---- CAPPADOCIA: the-envelope + the-mouth ---------------------------------
  await go('goreme');
  const ge = await page.evaluate(() => {
    const g = window.__capy.goreme;
    const e = g.envelope(), m = g.mouth();
    return [e.x, e.y, e.z, m.x, m.y, m.z];
  });
  // walk the envelope's length by sweeping a line through its centre
  for (const a of [0, 0.3, -0.3, 0.6, -0.6]) {
    await hold(ge[0] + Math.sin(a) * 6.4, ge[1] + 0.8, ge[2] + Math.cos(a) * 6.4, 0.8);
    await hold(ge[0] - Math.sin(a) * 6.4, ge[1] + 0.8, ge[2] - Math.cos(a) * 6.4, 0.8);
    if ((await done()).join('|').indexOf('envelope') >= 0) break;
  }
  await hold(ge[3], ge[4] + 1.0, ge[5], 3.0);
  out.got.push(['goreme', await done()]);

  out.errors = await page.evaluate(() => (window.__err || []).slice(0, 20));
  out.score = await page.evaluate(() => window.__capy.state.score);
  await page.evaluate(async o => {
    await fetch('/shot?name=newtasks.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
