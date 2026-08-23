async page => {
  const out = await page.evaluate(async () => {
    const errs = [];
    const oldErr = console.error;
    console.error = function (...a) { errs.push(a.map(x => (x && x.stack) || String(x)).join(' ')); oldErr.apply(console, a); };
    window.addEventListener('error', e => errs.push('WINDOW ' + (e.message || e.error)));

    const g = window.__capy;
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    const done = Object.create(null);
    g.events.on('task:complete', p => { if (p && p.id) done[p.id] = true; });

    const btns = document.querySelectorAll('.capyui-pick');
    if (btns[0]) btns[0].click();
    await sleep(500);

    const KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'KeyE', 'KeyQ', 'Space'];
    function up(k) { window.dispatchEvent(new KeyboardEvent('keyup', { code: k, bubbles: true })); }
    function down(k) { window.dispatchEvent(new KeyboardEvent('keydown', { code: k, bubbles: true })); }
    function allUp() { for (const k of KEYS) up(k); }
    async function tap(k, ms) { down(k); await sleep(ms || 60); up(k); await sleep(60); }

    function place(x, y, z) {
      const b = g.capy.body;
      b.position.set(x, y, z); b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      g.capy.position.set(x, y, z);
    }

    /** Walk toward a world point with a closed loop: movement is camera-relative
     *  and camYaw drifts, so the WASD set is recomputed every few frames. */
    async function walkTo(tx, tz, ms, run) {
      const t0 = performance.now();
      if (run) down('ShiftLeft');
      while (performance.now() - t0 < (ms || 6000)) {
        const p = g.capy.position;
        const dx = tx - p.x, dz = tz - p.z;
        if (dx * dx + dz * dz < 2.2 * 2.2) break;
        const cy = Math.cos(g.input.camYaw), sy = Math.sin(g.input.camYaw);
        // invert the camera-relative transform systems applies
        const ix = dx * cy - dz * sy;
        const iz = dx * sy + dz * cy;
        const m = Math.hypot(ix, iz) || 1;
        const nx = ix / m, nz = iz / m;
        if (nx > 0.35) { down('KeyD'); up('KeyA'); } else if (nx < -0.35) { down('KeyA'); up('KeyD'); }
        else { up('KeyA'); up('KeyD'); }
        if (nz > 0.35) { down('KeyS'); up('KeyW'); } else if (nz < -0.35) { down('KeyW'); up('KeyS'); }
        else { up('KeyW'); up('KeyS'); }
        await sleep(70);
      }
      allUp();
      await sleep(120);
      const p = g.capy.position;
      return Math.hypot(tx - p.x, tz - p.z);
    }

    /** Follow a flat [x,z,x,z] path by aiming at a point a few metres AHEAD on
     *  it, which is what a player does and what walkTo cannot: aiming at a knot
     *  thirty metres away and bang-banging the keys cuts every corner. */
    async function followPath(P, look, ms, endGate) {
      const t0 = performance.now();
      let i = 0;
      while (performance.now() - t0 < (ms || 30000)) {
        const p = g.capy.position;
        // advance the cursor to the nearest point, then look ahead of it
        let bi = i, bd = 1e9;
        for (let k = i; k < P.length / 2; k++) {
          const d = (P[k * 2] - p.x) ** 2 + (P[k * 2 + 1] - p.z) ** 2;
          if (d < bd) { bd = d; bi = k; }
        }
        i = bi;
        let j = i, run = 0;
        while (j + 1 < P.length / 2 && run < (look || 5)) {
          run += Math.hypot(P[(j + 1) * 2] - P[j * 2], P[(j + 1) * 2 + 1] - P[j * 2 + 1]);
          j++;
        }
        const tx = P[j * 2], tz = P[j * 2 + 1];
        if (j >= P.length / 2 - 1 && Math.hypot(tx - p.x, tz - p.z) < 2.5) break;
        if (endGate && endGate()) break;
        const cy = Math.cos(g.input.camYaw), sy = Math.sin(g.input.camYaw);
        const dx = tx - p.x, dz = tz - p.z;
        const ix = dx * cy - dz * sy, iz = dx * sy + dz * cy;
        const m = Math.hypot(ix, iz) || 1;
        const nx = ix / m, nz = iz / m;
        if (nx > 0.22) { down('KeyD'); up('KeyA'); } else if (nx < -0.22) { down('KeyA'); up('KeyD'); }
        else { up('KeyA'); up('KeyD'); }
        if (nz > 0.22) { down('KeyS'); up('KeyW'); } else if (nz < -0.22) { down('KeyW'); up('KeyS'); }
        else { up('KeyW'); up('KeyS'); }
        await sleep(45);
      }
      allUp();
      await sleep(150);
    }

    const log = [];
    function note(s) { log.push(s); }

    // =====================================================================
    // VENICE
    // =====================================================================
    g.biome.switchTo('venice');
    place(-4, 1.4, 13);
    await sleep(600);
    const V = g.venice;

    // --- spritz: walk to the cafe and press E
    let d = await walkTo(V.cafe.x + 2, V.cafe.z, 14000, true);
    note('venice walk->cafe residual ' + d.toFixed(1));
    for (let i = 0; i < 6 && !done['spritz-theft']; i++) { await tap('KeyE', 90); await sleep(200); }
    note('spritz ' + !!done['spritz-theft']);

    // --- pigeons: run through the middle of the square
    place(-4, 1.4, -18);
    await sleep(400);
    await walkTo(-4, -52, 12000, true);
    await sleep(2600);
    note('pigeons ' + !!done['pigeon-storm'] + ' peakUp ' + V.pigeonsUp());

    // --- rialto: run over it
    const r = V.rialto();
    // the bridge runs across the canal, so the run has to be taken along the
    // canal's NORMAL — a world-diagonal walk simply misses it
    const ax = r.ax, az = r.az;
    place(r.x + ax * 15, 3.2, r.z + az * 15);
    await sleep(900);
    {
      const P = [];
      for (let k = 0; k <= 20; k++) {
        const t = 15 - k * 1.5;
        P.push(r.x + ax * t, r.z + az * t);
      }
      await followPath(P, 4, 30000, () => !!done['rialto']);
    }
    note('rialtoCentre ' + r.x.toFixed(1) + ',' + r.z.toFixed(1) + ' ax ' + ax.toFixed(2) + ',' + az.toFixed(2));
    note('rialto ' + !!done['rialto'] + ' pos ' + g.capy.position.x.toFixed(1) + ',' +
         g.capy.position.z.toFixed(1) + ' y ' + g.capy.position.y.toFixed(1));

    // --- gondola: stand on it
    for (let i = 0; i < 40 && !done['gondola-ride']; i++) {
      const gp = V.gondola();
      place(gp.x, gp.y + 1.6, gp.z);
      await sleep(400);
    }
    note('gondola ' + !!done['gondola-ride']);

    // --- the tide: wind to the flood while standing in the square
    place(-4, 1.4, -34);
    await sleep(300);
    for (let i = 0; i < 4000 && V.tide() < 0.99; i++) g.venice.update(1 / 6);
    await sleep(900);
    note('tide ' + V.tide().toFixed(2) + ' waterY ' + V.tideY().toFixed(2) +
         ' flood ' + !!done['acqua-alta'] + ' boardsOut ' + V.boardsOut().toFixed(2));

    // --- swim the length of the flooded square
    place(-4, 1.6, -18);
    await sleep(600);
    await walkTo(-4, -52, 26000);
    await sleep(400);
    note('swim ' + !!done['mirror-swim'] + ' capyY ' + g.capy.position.y.toFixed(2) +
         ' wet ' + g.capy.wet.toFixed(2) + ' run ' + V.swimRun().toFixed(1) +
         ' at ' + g.capy.position.x.toFixed(1) + ',' + g.capy.position.z.toFixed(1));

    // --- the duckboards: walk them end to end
    // RE-WIND THE TIDE. Everything between the flood test and here has taken
    // ninety seconds of real time and the tide is a 205-second cycle, so by the
    // time the duckboard run starts the water has gone back out and the boards
    // are standing over dry paving — measured, the capybara walked the route on
    // the stones underneath them and the run never armed.
    for (let i = 0; i < 4000 && V.tide() < 0.98; i++) g.venice.update(1 / 6);
    await sleep(300);
    const b0 = V.boards();
    place(b0.x, b0.y + 0.9, b0.z);
    await sleep(700);
    note('onBoards@start ' + V.onBoards() + ' y ' + g.capy.position.y.toFixed(2));
    // FOLLOW THE CHAIN. Walking straight at the campo cuts every corner and
    // steps off the boards, which is exactly what the task is about.
    await followPath(V.boardPath(), 5, 60000, () => !!done['passerelle']);
    note('boards ' + !!done['passerelle'] + ' pos ' +
         g.capy.position.x.toFixed(1) + ',' + g.capy.position.z.toFixed(1) +
         ' y ' + g.capy.position.y.toFixed(2) + ' onBoards ' + V.onBoards() + ' out ' + V.boardsOut().toFixed(2) + ' t ' + V.onBoards());

    const venDone = ['to-venice', 'spritz-theft', 'pigeon-storm', 'passerelle',
                     'gondola-ride', 'rialto', 'acqua-alta', 'mirror-swim']
                    .filter(id => done[id]);

    // =====================================================================
    // HONG KONG
    // =====================================================================
    g.biome.switchTo('kowloon');
    place(0, 1.4, 34);
    await sleep(700);
    const K = g.kowloon;

    d = await walkTo(K.bakery.x + 4, K.bakery.z, 12000, true);
    note('hk walk->bakery residual ' + d.toFixed(1));
    for (let i = 0; i < 6 && !done['egg-tart']; i++) { await tap('KeyE', 90); await sleep(200); }
    note('tart ' + !!done['egg-tart']);

    // --- THE CLIMB. Stand at the scaffold, hold E, hold W into the wall.
    place(K.scaffold.x + 0.2, 1.4, K.scaffold.z);
    await sleep(700);
    // aim the camera so that 'into the wall' is W: the scaffold's normal is +x,
    // so the animal must face -x, which means camYaw must look along -x.
    const wantYaw = Math.atan2(1, 0);           // camera offset +x => looking -x
    {
      let dd = wantYaw - g.input.camYaw;
      while (dd > Math.PI) dd -= Math.PI * 2;
      while (dd < -Math.PI) dd += Math.PI * 2;
      const k = dd > 0 ? 'KeyZ' : 'KeyX';
      down(k);
      for (let i = 0; i < 400; i++) {
        await sleep(16);
        let e = wantYaw - g.input.camYaw;
        while (e > Math.PI) e -= Math.PI * 2;
        while (e < -Math.PI) e += Math.PI * 2;
        if (Math.sign(e) !== Math.sign(dd) || Math.abs(e) < 0.05) break;
      }
      up(k);
    }
    await sleep(300);
    const yStart = g.capy.position.y;
    down('KeyE'); down('KeyW');
    const climbSamples = [];
    for (let i = 0; i < 90; i++) {
      await sleep(100);
      if (i % 10 === 0) {
        climbSamples.push(+g.capy.position.y.toFixed(1) + (g.capy.climbing ? 'c' : '-') +
                          '@z' + g.capy.position.z.toFixed(1) + '/s' + g.capy.stamina.toFixed(2));
      }
      if (g.capy.position.y > 33) break;
    }
    up('KeyE'); up('KeyW');
    await sleep(500);
    note('climb from ' + yStart.toFixed(2) + ' to ' + g.capy.position.y.toFixed(2) +
         ' samples ' + climbSamples.join(' ') + ' task ' + !!done['bamboo-climb']);

    // --- laundry poles: cross the street at pole height
    place(-9, 12.4, 5);
    await sleep(900);
    note('poleStart y ' + g.capy.position.y.toFixed(2));
    {
      const t0 = performance.now(); let fell = '';
      const iv = setInterval(() => { if (!fell && g.capy.position.y < 9) fell = g.capy.position.x.toFixed(1) + ',' + g.capy.position.z.toFixed(1) + ' @' + ((performance.now()-t0)/1000).toFixed(1) + 's'; }, 60);
      const P = [];
      for (let k = 0; k <= 20; k++) P.push(-9 + k * 0.9, 5);
      await followPath(P, 3, 30000, () => !!done['laundry-pole']);
      clearInterval(iv);
      note('poleFell ' + (fell || 'no'));
    }
    note('poles ' + !!done['laundry-pole'] + ' y ' + g.capy.position.y.toFixed(2));

    // --- market
    place(K.market.x, 1.4, K.market.z);
    await sleep(600);
    for (let i = 0; i < 6 && !done['wet-market']; i++) { await tap('KeyE', 90); await sleep(200); }
    note('market ' + !!done['wet-market']);

    // --- the big sign
    place(K.sign.x, K.sign.y + 2.4, K.sign.z);
    await sleep(3000);
    note('sign ' + !!done['neon-sign'] + ' y ' + g.capy.position.y.toFixed(2));

    // --- the show, from the roof
    place(K.roof.x, 36, K.roof.z);
    await sleep(600);
    for (let i = 0; i < 4000 && !K.showing(); i++) g.kowloon.update(1 / 12);
    await sleep(1200);
    note('symphony ' + !!done['symphony'] + ' lit ' + K.litTowers() +
         ' skyward ' + K.skyward().toFixed(2));
    for (let i = 0; i < 120 && K.litTowers() < 15; i++) await sleep(100);
    note('litAfterBeats ' + K.litTowers());

    // --- the ferry
    for (let i = 0; i < 200 && !done['star-ferry']; i++) {
      const f = K.ferry();
      place(f.x, f.y + 2.2, f.z);
      await sleep(180);
    }
    note('ferry ' + !!done['star-ferry']);

    const hkDone = ['to-kowloon', 'egg-tart', 'bamboo-climb', 'laundry-pole',
                    'wet-market', 'neon-sign', 'symphony', 'star-ferry']
                   .filter(id => done[id]);

    allUp();
    return { log, venDone, hkDone, errs, lastError: g.state.lastError || null,
             recs: (function () {
               const o = {};
               ['passerelle', 'pigeon-storm', 'bamboo-climb', 'laundry-pole'].forEach(k => {
                 const el = null; o[k] = null;
               });
               return o;
             })() };
  });
  await page.evaluate(async o => {
    await fetch('/shot?name=play.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
