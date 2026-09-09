async page => {
  // A PICTURE OF THE GUARD. Job 2c is two arm rotations on a figure whose legs
  // are a merged mesh, and the only honest test of a posture is whether it
  // reads as one from the six metres this game is played at. Rob a Marrakech
  // stall until the square is hot, then stand the animal in front of the
  // person whose stock it was and put the camera on them.
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(6000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(3500);

  await page.evaluate(() => { window.__capy.biome.switchTo('sahara'); });
  await page.waitForTimeout(2500);

  const pick = await page.evaluate(() => {
    const g = window.__capy;
    const live = g.biome.current;
    const locs = (g.locals || []).filter(L => L && L.biome === live && L.fig);
    // The person with stock nearest their own anchor: the one the guard is for.
    let who = null, stall = null, best = 1e9;
    for (const p of (g.props || [])) {
      if (!p || (p.biome && p.biome !== live)) continue;
      if (typeof p.homeX !== 'number' || !isFinite(p.homeX)) continue;
      for (const L of locs) {
        const d = Math.hypot(L.ax - p.homeX, L.az - p.homeZ);
        if (d > 2.2 && d < best) { best = d; who = L; stall = p; }
      }
    }
    if (!who) return null;
    window.__b7who = who; window.__b7stall = stall;
    return { d: +best.toFixed(2), x: +who.ax.toFixed(1), z: +who.az.toFixed(1),
             stall: stall.type, sx: +stall.homeX.toFixed(1), sz: +stall.homeZ.toFixed(1) };
  });

  // Three robberies, five seconds apart — the incident gap is four.
  for (let k = 0; k < 3; k++) {
    await page.evaluate(() => {
      const g = window.__capy, s = window.__b7stall;
      const b = g.capy.body;
      b.position.set(s.homeX + 1.5, b.position.y, s.homeZ);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      try { g.events.emit('capy:grab', { prop: s, from: null }); } catch (e) {}
      try { g.events.emit('capy:graze', s); } catch (e) {}
    });
    await page.waitForTimeout(5200);
  }

  // Stand off the guard and point the boom at them.
  const shotOf = await page.evaluate(() => {
    const g = window.__capy, w = window.__b7who;
    const b = g.capy.body;
    let y = b.position.y;
    try { const t = g.sahara.terrainHeight(w.x, w.z - 5); if (isFinite(t)) y = t + 0.6; } catch (e) {}
    b.position.set(w.x, y, w.z - 5);
    b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    // The boom sits behind the animal on camYaw, so facing it AT the guard
    // means yawing to the bearing from the animal to them.
    g.input.camYaw = Math.atan2(w.x - b.position.x, w.z - b.position.z);
    return { heat: +(g.placeHeat(w.x, w.z) || 0).toFixed(3), grd: +(w.grd || 0).toFixed(3),
             watching: w.watching, guards: (g.locals || []).filter(L => L.grd > 0.05).length };
  });
  await page.waitForTimeout(3000);
  const now = await page.evaluate(() => {
    const g = window.__capy, w = window.__b7who;
    return { heat: +(g.placeHeat(w.x, w.z) || 0).toFixed(3), grd: +(w.grd || 0).toFixed(3),
             drift: +Math.hypot(w.x - w.ax, w.z - w.az).toFixed(3),
             guards: (g.locals || []).filter(L => L.grd > 0.05).length };
  });
  await page.evaluate((o) => fetch('/shot?name=B7-guard.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), { pick, shotOf, now });
}
