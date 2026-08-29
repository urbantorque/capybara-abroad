async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(6500);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2000);
  const step = (body) => page.evaluate(new Function(`
    const g = window.__capy;
    const api = g.quay;
    const b = g.capy.body;
    function clr() { g.input.x = 0; g.input.z = 0; g.input.run = false; g.input.action = false;
      g.input.actionPressed = false; g.input.honk = false; g.input.honkPressed = false;
      g.input.whistle = false; g.input.whistlePressed = false;
      g.input.jump = false; g.input.jumpPressed = false; }
    function hold(n) { for (let i = 0; i < n; i++) g.tick(1 / 60, false); }
    function useE() { g.input.action = true; g.input.actionPressed = true; g.tick(1/60,false);
      g.input.actionPressed = false; g.input.action = false; hold(20); }
    function voice() { g.input.honk = true; g.input.honkPressed = true;
      g.input.whistle = true; g.input.whistlePressed = true; g.tick(1/60,false);
      g.input.honkPressed = false; g.input.whistlePressed = false; hold(20);
      g.input.honk = false; g.input.whistle = false; }
    function boat() { return api.boat; }
    ` + body));

  const rows = [];
  await step(`g.biome.switchTo('quay'); hold(200); return g.biome.current;`);
  // stand at the helm and take it
  rows.push(await step(`
    const h = api.boat.helm;
    b.position.set(h.x, h.y + 0.4, h.z); b.velocity.set(0,0,0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    clr(); hold(60);
    useE(); hold(30);
    return { id: 'take-helm', done: !!g.taskDone('take-helm'),
             note: 'helm=' + [+h.x.toFixed(1), +h.y.toFixed(1), +h.z.toFixed(1)] +
                   ' atHelm=' + !!g.capy.atHelm };`));
  // drive north out of the berth: full ahead, steer for the target
  const drive = (tx, tz, secs, label) => step(`
    const T = { x: ${tx}, z: ${tz} };
    for (let i = 0; i < ${secs} * 60; i++) {
      const p = api.boat.position, yaw = api.boat.heading;
      const dx = T.x - p.x, dz = T.z - p.z;
      let want = Math.atan2(dx, dz) - yaw;
      while (want > Math.PI) want -= Math.PI * 2;
      while (want < -Math.PI) want += Math.PI * 2;
      g.input.x = Math.max(-1, Math.min(1, -want * 1.6));
      g.input.z = -1;               // stick forward = throttle up
      g.tick(1 / 60, false);
      if (Math.hypot(dx, dz) < 20) break;
    }
    clr();
    const p = api.boat.position;
    return { id: '${label}', at: [+p.x.toFixed(1), +p.z.toFixed(1)],
             speed: +api.boat.speed.toFixed(2),
             toQuay: !!g.taskDone('to-quay'), underBridge: !!g.taskDone('under-bridge'),
             yacht: !!g.taskDone('yacht-race'), dolphin: !!g.taskDone('dolphin-escort'),
             voyage: !!g.taskDone('manly-voyage'), salute: !!g.taskDone('ferry-salute') };`);

  rows.push(await drive(12, -58, 25, 'toBridge'));
  // sound the horn under the arch
  rows.push(await step(`voice(); hold(90);
    return { id: 'under-bridge', done: !!g.taskDone('under-bridge'),
             at: [+api.boat.position.x.toFixed(1), +api.boat.position.z.toFixed(1)] };`));
  rows.push(await drive(70, -330, 40, 'toRace'));
  rows.push(await drive(118, -544, 45, 'toManly'));
  rows.push(await step(`
    // ease off alongside
    for (let i = 0; i < 60 * 12; i++) { g.input.x = 0; g.input.z = 1; g.tick(1/60,false); }
    clr(); hold(180);
    const p = api.boat.position;
    return { id: 'arrive', at: [+p.x.toFixed(1), +p.z.toFixed(1)], speed: +api.boat.speed.toFixed(2),
             voyage: !!g.taskDone('manly-voyage') };`));
  // horn near the Freshwater for the salute
  rows.push(await step(`
    let n = 0, best = 1e9;
    for (let k = 0; k < 40 && !g.taskDone('ferry-salute'); k++) {
      const f = api.freshwater ? api.freshwater() : null;
      const p = api.boat.position;
      const d = f ? Math.hypot(f.x - p.x, f.z - p.z) : 1e9;
      if (d < best) best = d;
      if (d < 78) { voice(); hold(150); }
      else hold(120);
      n++;
    }
    return { id: 'ferry-salute', done: !!g.taskDone('ferry-salute'), note: 'closest=' + best.toFixed(1) + ' loops=' + n };`));
  // ashore, up the Corso for the chips
  rows.push(await step(`
    // leave the wheel, then walk to the chip shop
    useE(); hold(40);
    const T = { x: 118, z: -586 };
    const gy = (x, z) => { const h = api.terrainHeight ? api.terrainHeight(x, z) : 0; return h === h ? h : 0; };
    b.position.set(T.x, gy(T.x, T.z) + 0.8, T.z + 6); b.velocity.set(0,0,0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    clr(); hold(60);
    for (let i = 0; i < 900; i++) {
      const p = g.capy.position;
      const dx = T.x - p.x, dz = T.z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.7) { clr(); g.tick(1/60,false); continue; }
      const cy = g.input.camYaw || 0;
      g.input.x = (dx/d) * Math.cos(cy) + (dz/d) * (-Math.sin(cy));
      g.input.z = -((dx/d) * (-Math.sin(cy)) + (dz/d) * (-Math.cos(cy)));
      g.input.run = true;
      g.tick(1 / 60, false);
    }
    clr(); useE(); hold(120);
    return { id: 'manly-pine', done: !!g.taskDone('manly-pine'),
             at: [+g.capy.position.x.toFixed(1), +g.capy.position.y.toFixed(2), +g.capy.position.z.toFixed(1)],
             held: g.capy.heldProp ? g.capy.heldProp.type : '-' };`));
  const tail = await step(`return { lastError: g.state.lastError || null, biome: g.biome.current,
    done: ['to-quay','take-helm','under-bridge','yacht-race','dolphin-escort','manly-voyage','ferry-salute','manly-pine']
      .map(id => id + '=' + (g.taskDone(id) ? 'Y' : 'n')).join(' ') };`);
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rv-t3.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, { rows, tail });
}
