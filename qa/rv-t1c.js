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
      g.input.whistle = false; g.input.whistlePressed = false;
      g.input.jump = false; g.input.jumpPressed = false; }
    function hold(n) { for (let i = 0; i < n; i++) g.tick(1/60, false); }
    function park(x, z, y) {
      b.position.set(x, y === undefined ? 0.5 : y, z); b.velocity.set(0,0,0); b.angularVelocity.set(0,0,0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      clr(); hold(30);
    }
    function drive(tx, tz, n, run, stop) {
      for (let i = 0; i < n; i++) {
        const p = g.capy.position;
        const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
        if (d < (stop === undefined ? 0.8 : stop)) { clr(); g.tick(1/60,false); continue; }
        const cy = g.input.camYaw || 0;
        g.input.x = (dx/d) * Math.cos(cy) + (dz/d) * (-Math.sin(cy));
        g.input.z = -((dx/d) * (-Math.sin(cy)) + (dz/d) * (-Math.cos(cy)));
        g.input.run = !!run;
        g.tick(1/60, false);
      }
      clr();
    }
    function useE() { g.input.action = true; g.input.actionPressed = true; g.tick(1/60,false);
      g.input.actionPressed = false; g.input.action = false; hold(20); }
    function npcOf(f) { for (const r of g.npcs) if (r && f(r)) return r; return null; }
    function npcAt(r) { const p = r.group ? r.group.position : r; return { x: p.x, z: p.z }; }
    function xy(p) { return [+p.x.toFixed(1), +p.z.toFixed(1)]; }
    ` + body));

  const rows = [];
  await step(`g.biome.switchTo('sydney'); hold(200); return g.biome.current;`);

  rows.push(await step(`
    let note = '';
    for (let k = 0; k < 8 && !g.taskDone('steal-hat'); k++) {
      const r = npcOf(x => x.hasHat && x.kind !== 'gardener');
      if (!r) { note = 'NO HATTED NPC'; break; }
      const q = npcAt(r);
      park(q.x + 2, q.z + 2);
      for (let i = 0; i < 240; i++) {
        const p = npcAt(r);
        drive(p.x, p.z, 4, true, 0.55);
        if (i % 10 === 0) useE();
        if (g.taskDone('steal-hat')) break;
      }
      note = 'held=' + (g.capy.heldProp ? g.capy.heldProp.type : '-');
    }
    return { id: 'steal-hat', done: !!g.taskDone('steal-hat'), note: note };`));

  rows.push(await step(`
    let note = 'held=' + (g.capy.heldProp ? g.capy.heldProp.type : '-');
    drive(-10, -22, 1500, true, 1.0);
    hold(240);
    return { id: 'hat-harbour', done: !!g.taskDone('hat-harbour'),
             note: note + ' end=' + xy(g.capy.position) };`));

  rows.push(await step(`
    let note = '';
    for (let k = 0; k < 10 && !g.taskDone('coffee-spill'); k++) {
      const r = npcOf(x => x.heldProp && x.heldProp.type === 'coffee');
      if (!r) { note = 'NO COFFEE NPC'; break; }
      const q = npcAt(r);
      park(q.x + 7, q.z + 7);
      for (let i = 0; i < 200; i++) { const p = npcAt(r); drive(p.x, p.z, 4, true, 0.05); }
      hold(180);
      note = 'tries=' + (k + 1);
    }
    return { id: 'coffee-spill', done: !!g.taskDone('coffee-spill'), note: note };`));

  rows.push(await step(`
    const r = npcOf(x => x.hasCamera);
    let note = r ? '' : 'NO CAMERA NPC';
    if (r) {
      for (let k = 0; k < 12 && !g.taskDone('photo-op'); k++) {
        const q = npcAt(r);
        park(q.x + 3.2, q.z + 3.2);
        hold(420);
      }
      note = 'state=' + r.state;
    }
    return { id: 'photo-op', done: !!g.taskDone('photo-op'), note: note };`));

  rows.push(await step(`
    const gd = npcOf(x => x.kind === 'gardener');
    const bed = api.prizeBed;
    let note = gd ? '' : 'NO GARDENER';
    if (gd && bed) {
      for (let k = 0; k < 10 && !g.taskDone('chased'); k++) {
        park(bed.cx + 3, bed.cz + 3);
        drive(bed.cx, bed.cz, 260, true, 0.3);
        for (let i = 0; i < 260; i++) { g.input.action = true; g.tick(1/60,false); }
        clr(); hold(200);
      }
      note = 'gardener=' + xy(npcAt(gd)) + ' state=' + gd.state;
    }
    return { id: 'chased', done: !!g.taskDone('chased'), note: note };`));

  rows.push(await step(`
    const d = g.quay && g.quay.dog;
    const onLead = g.quay && g.quay.onLead ? g.quay.onLead() : null;
    let note = 'dogApi=' + !!d + ' onLead=' + onLead;
    if (d) {
      const q = d.position || d;
      park(q.x + 2, q.z + 2);
      drive(q.x, q.z, 300, false, 0.5);
      for (let k = 0; k < 8 && !g.taskDone('dog-loose'); k++) { useE(); hold(40); }
      note += ' at=' + xy(g.capy.position);
    }
    return { id: 'dog-loose', done: !!g.taskDone('dog-loose'), note: note };`));

  rows.push(await step(`
    const s = api.buskerSpot;
    const r = npcOf(x => x.kind === 'busker');
    const q = r ? npcAt(r) : s;
    park(q.x + 2, q.z + 2);
    drive(q.x, q.z, 300, false, 0.5);
    for (let k = 0; k < 10 && !g.taskDone('busker-hat'); k++) { useE(); hold(40); }
    return { id: 'busker-hat', done: !!g.taskDone('busker-hat'),
             note: 'busker=' + (r ? r.state : 'none') + ' held=' + (g.capy.heldProp ? g.capy.heldProp.type : '-') };`));

  rows.push(await step(`
    if (g.capy.heldProp) { useE(); hold(60); }
    let p = null;
    for (const q of g.props) if (q && q.type === 'chips' && !q.removed) { p = q; break; }
    let note = p ? '' : 'NO CHIPS PROP';
    if (p) {
      const q = p.body.position;
      park(q.x + 1.6, q.z + 1.6);
      drive(q.x, q.z, 300, false, 0.5);
      useE(); hold(40);
      note = 'held=' + (g.capy.heldProp ? g.capy.heldProp.type : '-');
      drive(-28, -4, 800, true, 0.8);
      hold(300);
      note += ' end=' + xy(g.capy.position);
    }
    return { id: 'seagull-chips', done: !!g.taskDone('seagull-chips'), note: note };`));

  rows.push(await step(`
    if (g.capy.heldProp) { useE(); hold(60); }
    let p = null;
    for (const q of g.props) if (q && q.type === 'ball' && !q.removed) { p = q; break; }
    let note = p ? '' : 'NO BALL PROP';
    if (p) {
      const q = p.body.position;
      park(q.x + 1.6, q.z + 1.6);
      drive(q.x, q.z, 300, false, 0.5);
      useE(); hold(40);
      note = 'held=' + (g.capy.heldProp ? g.capy.heldProp.type : '-');
      drive(-10, -20, 1200, true, 1.0);
      hold(400);
      note += ' end=' + xy(g.capy.position) + ' ball=' + xy(p.body.position);
    }
    return { id: 'ball-harbour', done: !!g.taskDone('ball-harbour'), note: note };`));

  const tail = await step(`return { lastError: g.state.lastError || null,
    done: ['wheek','steal-hat','coffee-spill','picnic-thief','bin-chicken','dig-flower','chased','photo-op',
           'opera-stage','ball-harbour','swim','hat-harbour','cafe-table','busker-hat','dog-loose',
           'seagull-chips','sprinkler','ferry-ride','whippy-run']
      .map(id => id + '=' + (g.taskDone(id) ? 'Y' : 'n')).join(' ') };`);
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rv-t1c.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, { rows, tail });
}
