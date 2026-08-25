async page => {
  const out = {};
  // ---- 6a. game.frameShot({over:true}) AT THE HELM ------------------------
  out.frameShot = await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('antarctic');
    const sp = g.biome.spawnOf('antarctic'), cb = g.capy.body;
    cb.position.set(sp.x, sp.y, sp.z); cb.velocity.set(0, 0, 0);
    cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position);
    function lens() {
      const c = g.camera.position, p = g.capy.position;
      const dx = c.x - p.x, dz = c.z - p.z, dy = c.y - p.y;
      const d = Math.hypot(dx, dz);
      return { yawDeg: +(Math.atan2(dx, dz) * 180 / Math.PI).toFixed(1),
               dist: +Math.hypot(dx, dy, dz).toFixed(2),
               pitchDeg: +(Math.atan2(dy, d) * 180 / Math.PI).toFixed(1),
               w: +g.framing().toFixed(3) };
    }
    function run(over) {
      g.frameShot(null);
      g.capy.atHelm = true; g.state.sailing = true;
      for (let i = 0; i < 60 * 5; i++) g.tick(1 / 60, false);   // let sailT saturate
      const before = lens();
      g.frameShot({ yaw: 1.2, dist: 26, pitch: 0.24, raise: 6.5, hold: 3.2, over: over });
      let peak = { d: 0 }; const trace = [];
      for (let i = 0; i < 60 * 3; i++) {
        g.tick(1 / 60, false);
        const l = lens();
        if (Math.abs(l.dist - before.dist) > peak.d) { peak = { d: Math.abs(l.dist - before.dist), l }; }
        if (i % 30 === 0) trace.push([+(i / 60).toFixed(1), l.dist, l.pitchDeg, l.w]);
      }
      return { over, before, peakDeltaDist: +peak.d.toFixed(2), at: peak.l, trace };
    }
    const offRes = run(false);
    const onRes = run(true);
    g.capy.atHelm = false; g.state.sailing = false; g.frameShot(null);
    // ...and what the SAME shot does on foot, as a control
    for (let i = 0; i < 60 * 3; i++) g.tick(1 / 60, false);
    const footBefore = lens();
    g.frameShot({ yaw: 1.2, dist: 26, pitch: 0.24, raise: 6.5, hold: 3.2 });
    let fp = 0, fl = null;
    for (let i = 0; i < 60 * 3; i++) {
      g.tick(1 / 60, false);
      const l = lens();
      if (Math.abs(l.dist - footBefore.dist) > fp) { fp = Math.abs(l.dist - footBefore.dist); fl = l; }
    }
    g.frameShot(null);
    return { helmNoOver: offRes, helmOver: onRes, onFoot: { before: footBefore, peakDeltaDist: +fp.toFixed(2), at: fl } };
  });
  // ---- 6b. capyPinOn against teleports ------------------------------------
  out.pin = await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('sydney');
    const sp = g.biome.spawnOf('sydney'), cb = g.capy.body;
    const r = [];
    for (const jump of [0.05, 0.2, 0.35, 0.5, 0.54, 0.6, 1.2]) {
      cb.position.set(sp.x, sp.y, sp.z); cb.velocity.set(0, 0, 0);
      cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position);
      for (let i = 0; i < 60 * 4; i++) g.tick(1 / 60, false);   // settle: the pin arms
      const x0 = cb.position.x, z0 = cb.position.z;
      cb.position.x = x0 + jump;
      cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position);
      g.tick(1 / 60, false);
      const vKick = +Math.hypot(cb.velocity.x, cb.velocity.z).toFixed(2);
      for (let i = 0; i < 60 * 2; i++) g.tick(1 / 60, false);
      const kept = +(cb.position.x - x0).toFixed(3);
      r.push({ askedMetres: jump, oneFrameVelocity: vKick, metresKeptAfter2s: kept,
               reverted: +(jump - kept).toFixed(3) });
    }
    return r;
  });
  // ---- and the distance blend of the calm field DURING a sprint ----------
  out.calmField = await page.evaluate(() => {
    const g = window.__capy, H = g.hud;
    const p = g.capy.position;
    for (let i = 0; i < 60 * 3; i++) {
      g.capy.body.velocity.x = 7;
      g.tick(1 / 60, false);
    }
    const c = H.calmAudit().calm;
    return { globalCalmWhileSprinting: +c.toFixed(3),
             at0: +g.calm(p.x, p.z).toFixed(3),
             at13: +g.calm(p.x + 13, p.z).toFixed(3),
             at26: +g.calm(p.x + 26, p.z).toFixed(3),
             at60: +g.calm(p.x + 60, p.z).toFixed(3) };
  });
  await page.evaluate(async o => {
    await fetch('/shot?name=b4fz-10.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out);
}
