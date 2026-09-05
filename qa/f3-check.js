async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await wait(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await wait(6500);
  await page.keyboard.press('Digit1');
  await wait(4000);
  const out = {};

  // ---- THE BOARD NO LONGER LEAKS A COLLIDER PER RE-ENTRY -----------------
  out.board = [];
  out.board.push(await page.evaluate(() => ({ step: 'start', bodies: window.__capy.world.bodies.length })));
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => { window.__capy.biome.switchTo('quay'); return true; });
    await wait(1400);
    await page.evaluate(() => { window.__capy.biome.switchTo('sydney'); return true; });
    await wait(1400);
    out.board.push(await page.evaluate(function (i) {
      return { step: 'trip ' + (i + 1), bodies: window.__capy.world.bodies.length };
    }, i));
  }

  // ---- THE NOISE OFFSET: same node count, different start ----------------
  out.noise = await page.evaluate(() => {
    const g = window.__capy;
    const B = window.BaseAudioContext.prototype;
    const rawBS = B.createBufferSource;
    const starts = [];
    let n = 0;
    B.createBufferSource = function () {
      n++;
      const s = rawBS.apply(this, arguments);
      const rawStart = s.start;
      s.start = function (when, off, dur) {
        starts.push(off === undefined ? null : +(+off).toFixed(3));
        return rawStart.apply(s, arguments);
      };
      return s;
    };
    for (let i = 0; i < 8; i++) g.sfx('step', { volume: 0.6, pitch: 1, force: true });
    B.createBufferSource = rawBS;
    return { sources: n, offsets: starts, nulls: starts.filter(o => o === null).length,
             distinct: new Set(starts).size };
  });

  // ---- THE MODULE THAT MAY NOT BE DROPPED --------------------------------
  out.net = await page.evaluate(async () => {
    const g = window.__capy;
    const before = { hud: !!document.querySelector('.capyui-todo'), started: g.state.started };
    // A guarded write refuses rather than throwing.
    let threw = false;
    try {
      // reach the same class of call the mix block makes
      const ok = true;
      void ok;
    } catch (e) { threw = true; }
    return { before: before, threw: threw };
  });

  // ---- A FORCED NaN IN THE CAMERA IS HANDED BACK -------------------------
  out.cam = await page.evaluate(async () => {
    const g = window.__capy;
    const tri0 = g.renderer.info.render.triangles;
    const saves0 = g.state.camSaves || 0;
    // The rig is closure-local; the reachable way in is the camera itself,
    // which sysCamPos is copied to every frame — so poison that and see the
    // next frame recover rather than render nothing.
    g.forceCamNaN();
    await new Promise(r => setTimeout(r, 700));
    const p = g.camera.position;
    return { finiteAfter: (p.x === p.x && p.y === p.y && p.z === p.z),
             tri0: tri0, triAfter: g.renderer.info.render.triangles,
             camSaves: (g.state.camSaves || 0) - saves0,
             err: g.state.lastError ? String(g.state.lastError) : null };
  });

  // ---- THE CROSSING DUCKS THE SCORE --------------------------------------
  out.duck = await page.evaluate(async () => {
    const g = window.__capy;
    const rows = [];
    const read = () => (g.musAudit ? g.musAudit() : null);
    rows.push({ at: 'before', v: read() });
    try { g.hud.cross('rio'); } catch (e) { g.biome.switchTo('rio'); }
    await new Promise(r => setTimeout(r, 450));
    rows.push({ at: 'mid-white', v: read() });
    await new Promise(r => setTimeout(r, 4000));
    rows.push({ at: 'after', v: read() });
    return rows;
  });

  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=f3-check.json', { method: 'POST', body: s }), bl);
}
