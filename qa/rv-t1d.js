async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(6500);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2000);
  const step = (body) => page.evaluate(new Function(`
    const g = window.__capy;
    const api = g.env, b = g.capy.body;
    function clr() { g.input.x = 0; g.input.z = 0; g.input.run = false; g.input.action = false;
      g.input.actionPressed = false; g.input.honk = false; g.input.honkPressed = false;
      g.input.jump = false; g.input.jumpPressed = false; }
    function hold(n) { for (let i = 0; i < n; i++) g.tick(1/60, false); }
    function park(x, z, y) {
      b.position.set(x, y === undefined ? 0.5 : y, z); b.velocity.set(0,0,0); b.angularVelocity.set(0,0,0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      clr(); hold(30);
    }
    function toward(tx, tz, run) {
      const p = g.capy.position;
      const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz) || 1;
      const cy = g.input.camYaw || 0;
      g.input.x = (dx/d) * Math.cos(cy) + (dz/d) * (-Math.sin(cy));
      g.input.z = -((dx/d) * (-Math.sin(cy)) + (dz/d) * (-Math.cos(cy)));
      g.input.run = !!run;
      return d;
    }
    function drive(tx, tz, n, run, stop) {
      for (let i = 0; i < n; i++) {
        const d = toward(tx, tz, run);
        if (d < (stop === undefined ? 0.8 : stop)) clr();
        g.tick(1/60, false);
      }
      clr();
    }
    function useE() { g.input.action = true; g.input.actionPressed = true; g.tick(1/60,false);
      g.input.actionPressed = false; g.input.action = false; hold(20); }
    function xy(p) { return [+p.x.toFixed(1), +p.z.toFixed(1)]; }
    ` + body));

  const rows = [];
  await step(`g.biome.switchTo('sydney'); hold(200); return g.biome.current;`);

  // sprinkler: stand on the valve and WAIT for somebody to walk through
  for (let k = 0; k < 6; k++) {
    const r = await step(`
      const s = api.sprinklers[0];
      if (Math.hypot(g.capy.position.x - s.x, g.capy.position.z - s.z) > 0.8) {
        park(s.x + 1.5, s.z + 1.5); drive(s.x, s.z, 260, false, 0.15);
      }
      hold(900);
      let wet = 0;
      for (const r of g.npcs) if (r && r.wet > 0.2) wet++;
      return { done: !!g.taskDone('sprinkler'), on: !!s.on, wetNpcs: wet };`);
    if (r.done) { rows.push({ id: 'sprinkler', done: true, note: 'after ' + (k + 1) * 15 + 's on the valve' }); break; }
    if (k === 5) rows.push({ id: 'sprinkler', done: false, note: JSON.stringify(r) });
  }

  // steal a hat, then DROP it in the harbour
  rows.push(await step(`
    const t = g.npcs.find(r => r && r.heldProp && r.heldProp.type === 'hat' && r.kind !== 'busker');
    const hat = t.heldProp, q = t.group.position;
    park(q.x + 2.0, q.z + 2.0);
    for (let i = 0; i < 400 && !g.capy.heldProp; i++) {
      const p = t.group.position;
      const d = toward(p.x, p.z, false);
      if (d < 1.2) { g.input.x = 0; g.input.z = 0; g.input.action = true; g.input.actionPressed = (i % 10 === 0); }
      g.tick(1/60, false); g.input.actionPressed = false;
    }
    clr(); hold(40);
    const got = g.capy.heldProp ? g.capy.heldProp.type : '-';
    return { id: 'steal-hat', done: !!g.taskDone('steal-hat'),
             note: 'held=' + got + ' wasStolen=' + !!hat.wasStolen };`));

  rows.push(await step(`
    // carry it out over the water and let go
    for (let i = 0; i < 60 * 25; i++) { toward(-10, -24, true); g.tick(1/60,false);
      if (g.capy.position.z < -14) break; }
    clr(); hold(30);
    useE(); hold(240);
    let hat = null;
    for (const p of g.props) if (p && p.type === 'hat' && p.wasStolen) hat = p;
    return { id: 'hat-harbour', done: !!g.taskDone('hat-harbour'),
             note: 'capy=' + xy(g.capy.position) +
                   (hat ? ' hat=' + xy(hat.body.position) + ' inWater=' + !!hat.inWater : ' NO STOLEN HAT') };`));

  // ferry-ride
  await step(`let n = 0; const f = api.ferry; while (!f.docked && n++ < 8000) g.tick(1/60,false); return n;`);
  await step(`
    const f = api.ferry, p = f.position;
    b.position.set(p.x, 1.4, p.z); b.velocity.set(0,0,0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    clr(); hold(60); return f.onBoard(g.capy.position);`);
  for (let k = 0; k < 8; k++) {
    const r = await step(`
      const f = api.ferry;
      for (let i = 0; i < 600 && !g.taskDone('ferry-ride'); i++) g.tick(1/60,false);
      return { done: !!g.taskDone('ferry-ride'), aboard: f.onBoard(g.capy.position), docked: f.docked,
               y: +g.capy.position.y.toFixed(2) };`);
    if (r.done) { rows.push({ id: 'ferry-ride', done: true, note: 'after ' + (k + 1) * 10 + 's aboard' }); break; }
    if (k === 7) rows.push({ id: 'ferry-ride', done: false, note: JSON.stringify(r) });
  }

  // whippy-run
  await step(`let n = 0; while (!api.vanParked() && n++ < 6000) g.tick(1/60,false); return n;`);
  await step(`
    const v = api.van();
    b.position.set(v.x, 2.9, v.z); b.velocity.set(0,0,0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    clr(); hold(60); return api.vanRiding();`);
  for (let k = 0; k < 6; k++) {
    const r = await step(`
      for (let i = 0; i < 600 && !g.taskDone('whippy-run'); i++) g.tick(1/60,false);
      return { done: !!g.taskDone('whippy-run'), riding: api.vanRiding(), parked: api.vanParked(),
               y: +g.capy.position.y.toFixed(2) };`);
    if (r.done) { rows.push({ id: 'whippy-run', done: true, note: 'after ' + (k + 1) * 10 + 's on the roof' }); break; }
    if (k === 5) rows.push({ id: 'whippy-run', done: false, note: JSON.stringify(r) });
  }

  const tail = await step(`return { lastError: g.state.lastError || null,
    done: ['sprinkler','steal-hat','hat-harbour','ferry-ride','whippy-run']
      .map(id => id + '=' + (g.taskDone(id) ? 'Y' : 'n')).join(' ') };`);
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rv-t1d.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, { rows, tail });
}
