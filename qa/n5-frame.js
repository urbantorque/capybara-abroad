async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(4800);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  // WHAT THE SHUTTER ACTUALLY SEES. The album thumbnail is a 288x180 downscale
  // of this same frame, so if the full frame is wrong the thumbnail is wrong
  // for the same reason — and a full frame can be looked at.
  const r = await page.evaluate(async () => {
    const g = window.__capy;
    const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
    g.biome.switchTo('sydney');
    tick(120);
    g.capy.body.position.set(6, 1.0, 34);
    g.capy.body.velocity.set(0, 0, 0);
    for (let i = 0; i < 60 * 60 && g.capy.nap < 0.95; i++) g.tick(1 / 60, false);
    // run up to just before the shutter, sampling the rig as the frame composes
    const trace = [];
    for (let i = 0; i < 60 * 200; i++) {
      g.tick(1 / 60, false);
      const d = g.napDebug();
      if (d.nextIn < 3.2) {
        trace.push({ nextIn: d.nextIn, shot: +g.camInfo.shot.toFixed(3),
                     dist: +g.camInfo.dist.toFixed(2), clear: +g.camInfo.clear.toFixed(3),
                     pitch: +g.camInfo.pitch.toFixed(3),
                     eyeD: +Math.hypot(g.camera.position.x - g.capy.position.x,
                                       g.camera.position.z - g.capy.position.z).toFixed(2) });
      }
      if (d.nextIn <= 0.02 && d.shots > 0) break;
      if (trace.length > 220) break;
    }
    // hold the frame the shutter just used, so a screenshot can be taken of it
    let alive = true;
    const loop = () => { if (!alive) return; requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    window.__pinStop = () => { alive = false; };
    g.frameShot({ dist: 3.6, near: true, pitch: 0.30, raise: 0.10, hold: 30, w: 1 });
    return { trace: trace.filter((x, i) => i % 12 === 0 || i === trace.length - 1),
             shots: g.napDebug().shots, err: g.state.lastError || null };
  });
  await page.waitForTimeout(2600);
  await page.screenshot({ path: 'qa/N5-shutter.png' });
  await page.evaluate(() => { if (window.__pinStop) window.__pinStop(); });
  await page.evaluate((o) => fetch('/shot?name=n5-frame.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), r);
}
