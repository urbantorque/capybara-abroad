async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(6500);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2000);
  const step = (body) => page.evaluate(new Function(`
    const g = window.__capy;
    const b = g.capy.body;
    function clr() { g.input.x = 0; g.input.z = 0; g.input.run = false; g.input.action = false;
      g.input.actionPressed = false; g.input.honk = false; g.input.honkPressed = false;
      g.input.whistle = false; g.input.whistlePressed = false;
      g.input.jump = false; g.input.jumpPressed = false; }
    function hold(n) { for (let i = 0; i < n; i++) g.tick(1/60, false); }
    function useE() { g.input.action = true; g.input.actionPressed = true; g.tick(1/60,false);
      g.input.actionPressed = false; g.input.action = false; hold(20); }
    function toward(tx, tz, run) {
      const p = g.capy.position;
      const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz) || 1;
      const cy = g.input.camYaw || 0;
      g.input.x = (dx/d) * Math.cos(cy) + (dz/d) * (-Math.sin(cy));
      g.input.z = -((dx/d) * (-Math.sin(cy)) + (dz/d) * (-Math.cos(cy)));
      g.input.run = !!run;
      return d;
    }
    ` + body));

  const rows = [];

  // ---- crater-drop -------------------------------------------------------
  await step(`g.biome.switchTo('pasto'); hold(220); return g.biome.current;`);
  rows.push(await step(`
    const api = g.pasto, c = api.craterCentre;
    // pick up anything grabbable, then carry it to the rim and drop it in
    let pr = null;
    for (const p of g.props) if (p && !p.removed && p.grabbable && !p.held &&
        (!p.biome || p.biome === 'pasto')) { pr = p; break; }
    let note = pr ? 'prop=' + pr.type : 'NO GRABBABLE PROP';
    if (pr) {
      const q = pr.body.position;
      b.position.set(q.x, q.y + 0.9, q.z); b.velocity.set(0,0,0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      clr(); hold(40); useE(); hold(40);
      note += ' held=' + (g.capy.heldProp ? g.capy.heldProp.type : '-');
      // teleport over the vent and let go
      const y = api.terrainHeight(c.x, c.z);
      b.position.set(c.x, (y === y ? y : 0) + 14, c.z); b.velocity.set(0,0,0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      clr(); hold(10); useE(); hold(60 * 25);
      note += ' craterY=' + (y === y ? y.toFixed(1) : '?') +
              ' propAt=' + [+pr.body.position.x.toFixed(1), +pr.body.position.y.toFixed(1), +pr.body.position.z.toFixed(1)];
    }
    return { id: 'crater-drop', done: !!g.taskDone('crater-drop'), note: note };`));

  // ---- thermal-peak: fly the condor up a column -------------------------
  await step(`
    const api = g.pasto;
    b.position.set(0, api.terrainHeight(0, 10) + 0.6, 10); b.velocity.set(0,0,0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    clr(); hold(60);
    return true;`);
  rows.push(await step(`
    function voice() { g.input.honk = true; g.input.honkPressed = true;
      g.input.whistle = true; g.input.whistlePressed = true; g.tick(1/60,false);
      g.input.honkPressed = false; g.input.whistlePressed = false; hold(20);
      g.input.honk = false; g.input.whistle = false; }
    voice(); hold(180); voice(); hold(180);
    // ride it: park the animal under the bird and press E
    for (let k = 0; k < 30 && !(g.condor && g.condor.mounted); k++) {
      const c = g.condor && g.condor.group;
      if (c) {
        const p = c.position, y = g.pasto.terrainHeight(p.x, p.z);
        b.position.set(p.x, (y === y ? y : 0) + 0.6, p.z); b.velocity.set(0,0,0);
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      }
      g.input.action = true; g.input.actionPressed = true; g.tick(1/60,false);
      g.input.actionPressed = false; hold(30); g.input.action = false;
    }
    return { id: '_mount', mounted: !!(g.condor && g.condor.mounted),
             state: g.condor ? g.condor.state : '?' };`));
  for (let k = 0; k < 8; k++) {
    const r = await step(`
      // steer for the crater and hold the stick back in the column
      const api = g.pasto, c = api.craterCentre;
      for (let i = 0; i < 600; i++) {
        const p = g.condor && g.condor.group ? g.condor.group.position : g.capy.position;
        const dx = c.x - p.x, dz = c.z - p.z, d = Math.hypot(dx, dz) || 1;
        const cy = g.input.camYaw || 0;
        g.input.x = (dx/d) * Math.cos(cy) + (dz/d) * (-Math.sin(cy));
        g.input.z = -((dx/d) * (-Math.sin(cy)) + (dz/d) * (-Math.cos(cy)));
        g.tick(1/60, false);
        if (g.taskDone('thermal-peak')) break;
      }
      clr();
      const p = g.capy.position;
      return { done: !!g.taskDone('thermal-peak'), mounted: !!(g.condor && g.condor.mounted),
               state: g.condor ? g.condor.state : '?',
               y: +p.y.toFixed(1), at: [+p.x.toFixed(0), +p.z.toFixed(0)] };`);
    if (r.done) { rows.push({ id: 'thermal-peak', done: true, note: 'after ' + (k + 1) * 10 + 's' }); break; }
    if (k === 7) rows.push({ id: 'thermal-peak', done: false, note: JSON.stringify(r) });
  }

  // ---- yacht-race --------------------------------------------------------
  await step(`g.biome.switchTo('quay'); hold(200); return g.biome.current;`);
  rows.push(await step(`
    const api = g.quay, h = api.boat.helm;
    b.position.set(h.x, h.y + 0.4, h.z); b.velocity.set(0,0,0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    clr(); hold(60); useE(); hold(30);
    return { id: '_helm', atHelm: !!g.capy.atHelm };`));
  for (let k = 0; k < 12; k++) {
    const r = await step(`
      // steer for whichever yacht is nearest, flat out
      const api = g.quay;
      for (let i = 0; i < 900; i++) {
        const p = api.boat.position, yaw = api.boat.heading;
        let tx = 70, tz = -330, bd = 1e9;
        if (api.fleetAt) { /* not published */ }
        // the fleet legs, mirrored from quay.js
        const F = [-6,-212,108,-244,46, 118,-258,4,-230,53, 10,-320,124,-346,49,
                   132,-334,18,-308,51, 22,-424,142,-456,55, 148,-446,28,-416,44];
        const t = g.state.time;
        for (let j = 0; j < 6; j++) {
          const o = j * 5, per = F[o + 4];
          const u = 0.5 - 0.5 * Math.cos((t / per + j * 0.37) * Math.PI * 2);
          const x = F[o] + (F[o+2] - F[o]) * u, z = F[o+1] + (F[o+3] - F[o+1]) * u;
          const d = Math.hypot(x - p.x, z - p.z);
          if (d < bd) { bd = d; tx = x; tz = z; }
        }
        let want = Math.atan2(tx - p.x, tz - p.z) - yaw;
        while (want > Math.PI) want -= Math.PI * 2;
        while (want < -Math.PI) want += Math.PI * 2;
        g.input.x = Math.max(-1, Math.min(1, -want * 1.8));
        g.input.z = -1;
        g.tick(1/60, false);
        if (g.taskDone('yacht-race')) break;
      }
      clr();
      const p = api.boat.position;
      return { done: !!g.taskDone('yacht-race'), at: [+p.x.toFixed(0), +p.z.toFixed(0)],
               speed: +api.boat.speed.toFixed(1) };`);
    if (r.done) { rows.push({ id: 'yacht-race', done: true, note: 'after ' + (k + 1) * 15 + 's' }); break; }
    if (k === 11) rows.push({ id: 'yacht-race', done: false, note: JSON.stringify(r) });
  }

  const tail = await step(`return { lastError: g.state.lastError || null, biome: g.biome.current };`);
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rv-t5.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, { rows, tail });
}
