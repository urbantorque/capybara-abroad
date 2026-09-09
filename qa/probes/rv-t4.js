async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(6500);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2000);
  const step = (body) => page.evaluate(new Function(`
    const g = window.__capy;
    const api = g.kyoto;
    const b = g.capy.body;
    function clr() { g.input.x = 0; g.input.z = 0; g.input.run = false; g.input.action = false;
      g.input.actionPressed = false; g.input.honk = false; g.input.honkPressed = false;
      g.input.whistle = false; g.input.whistlePressed = false;
      g.input.jump = false; g.input.jumpPressed = false; }
    function hold(n) { for (let i = 0; i < n; i++) g.tick(1 / 60, false); }
    function gy(x, z) { const h = api.terrainHeight(x, z); return h === h ? h : 0; }
    function park(x, z, dy) {
      b.position.set(x, gy(x, z) + (dy === undefined ? 0.6 : dy), z);
      b.velocity.set(0,0,0); b.angularVelocity.set(0,0,0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      clr(); hold(40);
    }
    function drive(tx, tz, n, run, stop, jumpEvery) {
      for (let i = 0; i < n; i++) {
        const p = g.capy.position;
        const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
        if (d < (stop === undefined ? 0.8 : stop)) { clr(); g.tick(1/60,false); continue; }
        const cy = g.input.camYaw || 0;
        g.input.x = (dx/d) * Math.cos(cy) + (dz/d) * (-Math.sin(cy));
        g.input.z = -((dx/d) * (-Math.sin(cy)) + (dz/d) * (-Math.cos(cy)));
        g.input.run = !!run;
        if (jumpEvery && i % jumpEvery === 0) { g.input.jump = true; g.input.jumpPressed = true; }
        g.tick(1 / 60, false);
        g.input.jumpPressed = false;
      }
      clr();
    }
    function useE() { g.input.action = true; g.input.actionPressed = true; g.tick(1/60,false);
      g.input.actionPressed = false; g.input.action = false; hold(20); }
    ` + body));

  const rows = [];
  await step(`g.biome.switchTo('kyoto'); hold(220); return g.biome.current;`);

  rows.push(await step(`
    // torii-run: through every gate in order
    const s = api.toriiStart;
    park(s.x, s.z - 4);
    for (let k = 0; k < 240; k++) {
      const n = api.toriiNext();
      if (!n) break;
      drive(n.x, n.z, 200, true, 0.5);
      if (api.toriiProgress() >= 1) break;
    }
    return { id: 'torii-run', done: !!g.taskDone('torii-run'),
             note: 'progress=' + api.toriiProgress().toFixed(2) };`));

  rows.push(await step(`
    const l = api.lanterns;
    let note = '';
    for (let i = 0; i < l.length && !g.taskDone('lantern-topple'); i += 3) {
      const x = l[i], z = l[i + 1];
      park(x + 6, z + 6);
      drive(x, z, 300, true, 0.1);
      hold(90);
      note = 'tried ' + ((i / 3) + 1);
    }
    return { id: 'lantern-topple', done: !!g.taskDone('lantern-topple'), note: note };`));

  rows.push(await step(`
    const z = api.zen;
    park(z.x - 5, z.z - 5);
    for (let k = 0; k < 8; k++) {
      drive(z.x + (k % 2 ? 4 : -4), z.z + (k % 3 ? 3 : -3), 260, true, 0.4);
    }
    return { id: 'zen-ruin', done: !!g.taskDone('zen-ruin'), note: 'zen=' + [z.x, z.z] };`));

  rows.push(await step(`
    const p = api.pond;
    park(p.x, p.z + (p.rz || 9) + 5);
    drive(p.x, p.z, 1400, true, 0.6);
    hold(300);
    return { id: 'golden-swim', done: !!g.taskDone('golden-swim'),
             note: 'swimming=' + !!g.capy.swimming + ' at=' + [+g.capy.position.x.toFixed(1), +g.capy.position.y.toFixed(2), +g.capy.position.z.toFixed(1)] };`));


  rows.push(await step(`
    // dry-crossing: the six stones, then the island
    const P = { x: 30, z: -12 };
    const st = i => ({ x: P.x - 9 - i * 2.6, z: P.z - 8 + Math.sin(i * 1.3) * 1.6 });
    const s5 = st(5);
    park(s5.x - 3, s5.z, 0.9);
    for (let i = 5; i >= 0; i--) { const q = st(i); drive(q.x, q.z, 260, false, 0.3, 20); }
    drive(P.x, P.z, 700, false, 1.0, 26);
    hold(120);
    return { id: 'dry-crossing', done: !!g.taskDone('dry-crossing'),
             note: 'wet=' + (g.capy.wet || 0).toFixed(2) + ' at=' + [+g.capy.position.x.toFixed(1), +g.capy.position.y.toFixed(2), +g.capy.position.z.toFixed(1)] };`));

  rows.push(await step(`
    const bm = api.bamboo;
    for (const t of [[bm.x, bm.z - bm.hz - 6], [bm.x, bm.z + bm.hz + 6],
                     [bm.x - bm.hx - 6, bm.z], [bm.x + bm.hx + 6, bm.z]]) {
      if (g.taskDone('bamboo-dash')) break;
      park(bm.x - (t[0] - bm.x) * 0.9, bm.z - (t[1] - bm.z) * 0.9);
      drive(t[0], t[1], 1400, true, 0.6);
    }
    return { id: 'bamboo-dash', done: !!g.taskDone('bamboo-dash'),
             note: 'at=' + [+g.capy.position.x.toFixed(1), +g.capy.position.z.toFixed(1)] };`));

  rows.push(await step(`
    const br = api.bridge, mi = api.mill;
    park(br.x, br.z, 0.6);
    let n = 0;
    for (let i = 0; i < 60 * 90 && !g.taskDone('uji-run'); i++) {
      const p = g.capy.position;
      const a = api.aheadOnRiver ? api.aheadOnRiver(p.x, p.z, 12) : null;
      const tx = a ? a.x : mi.x, tz = a ? a.z : mi.z;
      const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz) || 1;
      const cy = g.input.camYaw || 0;
      g.input.x = (dx/d) * Math.cos(cy) + (dz/d) * (-Math.sin(cy));
      g.input.z = -((dx/d) * (-Math.sin(cy)) + (dz/d) * (-Math.cos(cy)));
      g.input.run = true;
      g.tick(1/60, false); n++;
    }
    clr();
    return { id: 'uji-run', done: !!g.taskDone('uji-run'),
             note: 'inRiver=' + api.inRiver() + ' t=' + api.runTime().toFixed(1) +
                   ' at=' + [+g.capy.position.x.toFixed(1), +g.capy.position.z.toFixed(1)] };`));

  rows.push(await step(`
    const h = api.matchaHeap;
    park(h.x + 4, h.z + 4);
    drive(h.x, h.z, 500, true, 0.3);
    hold(180);
    return { id: 'matcha-raid', done: !!g.taskDone('matcha-raid'),
             note: 'heap=' + [+h.x.toFixed(1), +h.z.toFixed(1)] + ' at=' + [+g.capy.position.x.toFixed(1), +g.capy.position.z.toFixed(1)] };`));

  rows.push(await step(`
    const r = api.bellRope();
    park(r.x + 2.5, r.z + 2.5);
    drive(r.x, r.z, 400, false, 0.5);
    useE(); hold(20);
    const rang = api.bellRinging();
    const B = api.bell;
    drive(B.x, B.z, 300, true, 0.4);
    hold(400);
    return { id: 'the-bell', done: !!g.taskDone('the-bell'),
             note: 'rope=' + [+r.x.toFixed(1), +r.z.toFixed(1)] + ' rang=' + rang +
                   ' under=' + api.underBell() };`));

  rows.push(await step(`
    const w = api.bowl;
    let best = 0;
    for (const r of [3.0, 4.0, 5.0, 6.0]) {
      if (g.taskDone('whisk-spin')) break;
      park(w.x + r, w.z, 1.2);
      for (let k = 0; k < 700 && !g.taskDone('whisk-spin'); k++) {
        const a = k * 0.06;
        drive(w.x + Math.cos(a) * r, w.z + Math.sin(a) * r, 6, true, 0.15);
      }
      best = r;
    }
    return { id: 'whisk-spin', done: !!g.taskDone('whisk-spin'),
             note: 'bowl=' + JSON.stringify(w) + ' lastR=' + best +
                   ' at=' + [+g.capy.position.x.toFixed(1), +g.capy.position.y.toFixed(2), +g.capy.position.z.toFixed(1)] };`));

  const tail = await step(`return { lastError: g.state.lastError || null, biome: g.biome.current,
    done: ['torii-run','lantern-topple','zen-ruin','dry-crossing','golden-swim','bamboo-dash','uji-run','matcha-raid','the-bell','whisk-spin']
      .map(id => id + '=' + (g.taskDone(id) ? 'Y' : 'n')).join(' ') };`);
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rv-t4.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, { rows, tail });
}
