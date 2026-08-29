async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2000);

  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const down = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }));
    const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }));
    const ALL = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft'];
    const clear = () => ALL.forEach(up);

    g.biome.switchTo('monaco');
    for (let i = 0; i < 90; i++) g.tick(1 / 60, false);

    // start on the quay at the foot of the passerelle
    const b = g.capy.body;
    b.position.set(10, 4.0, -84);
    b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false);

    // The route up the boat, as a player would take it. Each leg is a world
    // point; the keys are recomputed from input.camYaw every frame because
    // movement is camera-relative and the camera drifts.
    const LEGS = [
      { x: 10,   z: -76,   hop: false, t: 9 },   // up the passerelle, aft deck
      { x: 7.8,  z: -75.5, hop: false, t: 6 },   // to the foot of flight A
      { x: 7.8,  z: -70.2, hop: true,  t: 12 },  // up flight A onto the bridge deck
      { x: 6.9,  z: -69.0, hop: false, t: 8 },   // onto the port side deck
      { x: 6.9,  z: -56.0, hop: false, t: 16 },  // forward past the sun-deck house
      { x: 10,   z: -53.0, hop: false, t: 12 },  // onto the foredeck, foot of flight B
      { x: 10,   z: -57.4, hop: true,  t: 14 },  // up flight B onto the sun deck
      { x: 11.4, z: -62.0, hop: false, t: 12 },  // to the lounger with the jacket on it
    ];

    const log = [];
    for (let L = 0; L < LEGS.length; L++) {
      const leg = LEGS[L];
      const frames = Math.round(leg.t * 60);
      let best = 1e9, stuckAt = null, hopT = 0;
      for (let f = 0; f < frames; f++) {
        const p = g.capy.position;
        const wx = leg.x - p.x, wz = leg.z - p.z;
        const d = Math.hypot(wx, wz);
        if (d < best) best = d;
        if (d < 0.55) break;
        const cy = Math.cos(g.input.camYaw), sy = Math.sin(g.input.camYaw);
        const nx = wx / d, nz = wz / d;
        const ix = nx * cy - nz * sy;      // invert the camera-relative basis
        const iz = nx * sy + nz * cy;
        clear();
        if (iz < -0.35) down('KeyW');
        if (iz > 0.35) down('KeyS');
        if (ix < -0.35) down('KeyA');
        if (ix > 0.35) down('KeyD');
        // a hop every ~0.5 s on a flight of stairs, which is what a player does
        if (leg.hop) { hopT += 1 / 60; if (hopT > 0.5) { hopT = 0; down('Space'); } }
        g.tick(1 / 60, false);
        if (f === frames - 1) stuckAt = { x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2) };
      }
      clear();
      for (let i = 0; i < 20; i++) g.tick(1 / 60, false);
      const p = g.capy.position;
      log.push({ leg: L, to: [leg.x, leg.z], reached: best < 0.8,
                 closest: +best.toFixed(2),
                 at: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)], stuckAt });
      if (best > 2.5) break;             // no point walking the rest of a broken route
    }

    // now try to pick the jacket up
    let grabbed = false;
    for (let i = 0; i < 200 && !grabbed; i++) {
      if (i % 40 === 0) { down('KeyE'); }
      g.tick(1 / 60, false);
      if (i % 40 === 6) up('KeyE');
      grabbed = !!(g.capy.heldProp && g.capy.heldProp.type === 'dinnerjacket');
    }
    clear();
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false);

    const tux = (g.props || []).find(p => p.type === 'dinnerjacket');
    const blackTie = g.taskDone('black-tie');

    // ---- and now the other task that needed this deck: nine metres down ----
    // Walk off the port side of the sun deck and land in the harbour.
    let dive = null;
    if (blackTie || grabbed) {
      const b2 = g.capy.body;
      b2.position.set(10, 9.2, -62); b2.velocity.set(0, 0, 0);
      b2.previousPosition.copy(b2.position); b2.interpolatedPosition.copy(b2.position);
      for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
      for (let f = 0; f < 60 * 14; f++) {
        const p = g.capy.position;
        const wx = -6 - p.x, wz = -62 - p.z;       // straight off the port beam
        const d = Math.hypot(wx, wz);
        const cy = Math.cos(g.input.camYaw), sy = Math.sin(g.input.camYaw);
        const nx = wx / d, nz = wz / d;
        const ix = nx * cy - nz * sy, iz = nx * sy + nz * cy;
        clear();
        if (iz < -0.35) down('KeyW');
        if (iz > 0.35) down('KeyS');
        if (ix < -0.35) down('KeyA');
        if (ix > 0.35) down('KeyD');
        g.tick(1 / 60, false);
        if (g.taskDone('high-dive')) break;
      }
      clear();
      for (let i = 0; i < 120; i++) g.tick(1 / 60, false);
      const p = g.capy.position;
      dive = { done: g.taskDone('high-dive'), at: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)] };
    }

    return {
      route: log,
      grabbed,
      held: g.capy.heldProp ? g.capy.heldProp.type : null,
      tuxAt: tux ? [+tux.body.position.x.toFixed(2), +tux.body.position.y.toFixed(2), +tux.body.position.z.toFixed(2)] : null,
      blackTie,
      superyacht: g.taskDone('superyacht'),
      dive,
      err: g.state.lastError || null,
    };
  });

  await page.evaluate(async (o) => {
    await fetch('/shot?name=tuxwalk.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
