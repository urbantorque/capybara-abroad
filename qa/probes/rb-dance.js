async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://localhost:5199/index.html?cb=' + Math.random());
  await page.waitForTimeout(7000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(3000);

  // ---- CALI: the salsa floor ----------------------------------------
  await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('cali');
    window.__hook = null;
  });
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const g = window.__capy;
    const A = g.cali;
    const raw = g.tick.bind(g);
    window.__rawTick = raw;
    window.__log = { beats: 0, presses: 0, combo: 0, music: false };
    g.tick = function (dt, r) {
      const b = g.capy.body;
      b.position.set(A.floor.x, A.terrainHeight(A.floor.x, A.floor.z) + 0.6, A.floor.z);
      b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      const m = g.music;
      if (m && m.playing) {
        window.__log.music = true;
        if (Math.abs(m.off()) < 0.08) { g.input.jumpPressed = true; window.__log.presses++; }
      }
      const c = A.combo();
      if (c > window.__log.combo) window.__log.combo = c;
      return raw(dt, r);
    };
  });
  await page.waitForTimeout(25000);
  const cali = await page.evaluate(() => {
    const g = window.__capy;
    g.tick = window.__rawTick;
    return { done: !!g.taskDone('salsa-dance'), log: window.__log,
             onFloor: g.cali.onFloor(), target: g.cali.comboTarget,
             err: g.state.lastError || null };
  });

  // ---- RIO: the samba column ----------------------------------------
  await page.evaluate(() => { window.__capy.biome.switchTo('rio'); });
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const g = window.__capy;
    const A = g.rio;
    const raw = g.tick.bind(g);
    window.__rawTick = raw;
    window.__log2 = { presses: 0, combo: 0, music: false, inCol: false };
    g.tick = function (dt, r) {
      const col = A.column();
      const b = g.capy.body;
      b.position.set(col.x, A.terrainHeight(col.x, col.z) + 0.6, col.z);
      b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      const m = g.music;
      if (m && m.playing) {
        window.__log2.music = true;
        const bt = Math.round(m.beats());
        const onTwo = ((bt % 2) + 2) % 2 === 1;
        if (onTwo && Math.abs(m.off()) < 0.08) { g.input.jumpPressed = true; window.__log2.presses++; }
      }
      const c = A.combo();
      if (c > window.__log2.combo) window.__log2.combo = c;
      if (A.inColumn()) window.__log2.inCol = true;
      return raw(dt, r);
    };
  });
  await page.waitForTimeout(25000);
  const rio = await page.evaluate(() => {
    const g = window.__capy;
    g.tick = window.__rawTick;
    return { done: !!g.taskDone('samba-parade'), bateria: !!g.taskDone('bateria'),
             log: window.__log2, target: g.rio.comboTarget, err: g.state.lastError || null };
  });

  await page.evaluate(async (o) => {
    await fetch('/shot?name=rb-dance.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, { cali: cali, rio: rio });
}
