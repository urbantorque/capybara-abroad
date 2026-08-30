async page => {
  const KEYS = { sydney: 'Digit1', venice: 'Digit0', kowloon: 'Minus',
                 antarctic: 'Quote', hanoi: 'Slash' };
  const out = [];
  for (const name in KEYS) {
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload();
    await page.waitForTimeout(5200);
    await page.keyboard.press(KEYS[name]);
    await page.waitForTimeout(8000);
    const rows = await page.evaluate(() => {
      const g = window.__capy, s = g.state;
      const gl = g.renderer.getContext();
      const px = new Uint8Array(4);
      // A readPixels forces the driver to finish everything queued, so the wall
      // clock across N composite passes is the composite pass and not the depth
      // of the command queue. An rAF-interval benchmark cannot see any of this:
      // the game is vsync-locked and both arms read 16.6-17.0 whatever happens.
      const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const bench = () => {
        for (let i = 0; i < 20; i++) g.post.render();
        sync();
        const t0 = performance.now();
        for (let i = 0; i < 60; i++) g.post.render();
        sync();
        return (performance.now() - t0) / 60;
      };
      // g.tick(0, false) re-runs sysDressFrame so the switches reach the params
      // without stepping the world.
      const set = (v) => { s.noDepth = v; g.tick(0, false); };
      // ...and the three terms one at a time, so a cost can be ATTRIBUTED.
      const only = (dof, air, cr) => {
        s.noDepth = false; s.noDof = !dof; s.noAir = !air; s.noCrease = !cr;
        g.tick(0, false);
      };
      const md = a => +a.slice().sort((p, q) => p - q)[2].toFixed(3);
      const OFF = [], ALL = [], DOF = [], AIR = [], CR = [];
      // INTERLEAVED, medians of five. The first arm of every run in this repo
      // has measured 5-10% slow, so whichever arm goes first wins if they are
      // not interleaved.
      for (let i = 0; i < 5; i++) {
        set(true);              OFF.push(bench());
        only(1, 1, 1);          ALL.push(bench());
        only(1, 0, 0);          DOF.push(bench());
        only(0, 1, 0);          AIR.push(bench());
        only(0, 0, 1);          CR.push(bench());
      }
      s.noDepth = false; s.noDof = false; s.noAir = false; s.noCrease = false;
      g.tick(0, false);
      const o = md(OFF);
      return { offMs: o, allMs: md(ALL),
               dAll: +(md(ALL) - o).toFixed(3),
               dDof: +(md(DOF) - o).toFixed(3),
               dAir: +(md(AIR) - o).toFixed(3),
               dCrease: +(md(CR) - o).toFixed(3),
               rawOff: OFF.map(x => +x.toFixed(2)),
               rawAll: ALL.map(x => +x.toFixed(2)) };
    });
    out.push({ name: name, rows: rows });
  }
  await page.evaluate(o => fetch('/shot?name=depthperf.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out);
}
