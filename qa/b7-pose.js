async page => {
  // THE GUARD POSE, COLD AND HOT, FROM THE SAME CAMERA. Two arm rotations on a
  // figure with no elbows: if the pair of pictures is indistinguishable then
  // 2c is a number and not a posture, and that is the finding.
  // PHASE is a literal — run-code takes no argument (harness trap 14).
  const PHASE = 'cold';

  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(6000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(3500);
  await page.evaluate(() => { window.__capy.biome.switchTo('sahara'); });
  await page.waitForTimeout(2500);

  const r = await page.evaluate((phase) => {
    const g = window.__capy;
    const live = g.biome.current;
    const locs = (g.locals || []).filter(L => L && L.biome === live && L.fig);
    let who = null, best = 1e9;
    for (const p of (g.props || [])) {
      if (!p || (p.biome && p.biome !== live)) continue;
      if (typeof p.homeX !== 'number' || !isFinite(p.homeX)) continue;
      for (const L of locs) {
        const d = Math.hypot(L.ax - p.homeX, L.az - p.homeZ);
        if (d > 2.2 && d < best) { best = d; who = L; }
      }
    }
    if (!who) return null;
    g.forceHeat(phase === 'hot' ? 1 : 0);
    const b = g.capy.body;
    // Stand off SIDEWAYS: the arms swing about X, so a person seen head-on
    // hides the whole gesture behind their own torso.
    let y = b.position.y;
    try { const t = g.sahara.terrainHeight(who.ax + 3.4, who.az); if (isFinite(t)) y = t + 0.6; } catch (e) {}
    b.position.set(who.ax + 3.4, y, who.az);
    b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    g.input.camYaw = Math.atan2(who.ax - b.position.x, who.az - b.position.z);
    window.__b7who = who;
    return { x: +who.ax.toFixed(1), z: +who.az.toFixed(1), stockAt: +best.toFixed(2) };
  }, PHASE);

  await page.waitForTimeout(4000);
  const pose = await page.evaluate(() => {
    const g = window.__capy, w = window.__b7who;
    return { grd: +(w.grd || 0).toFixed(3),
             armLx: +w.fig.armL.rotation.x.toFixed(3),
             armRx: +w.fig.armR.rotation.x.toFixed(3),
             drift: +Math.hypot(w.x - w.ax, w.z - w.az).toFixed(3),
             heat: +(g.placeHeat(w.ax, w.az) || 0).toFixed(3) };
  });
  await page.evaluate((o) => fetch('/shot?name=B7-pose-' + o.phase + '.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), { phase: PHASE, r, pose });
}
