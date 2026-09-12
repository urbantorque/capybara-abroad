async page => {
  await page.reload();
  await page.waitForTimeout(6000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);
  const names = ['sydney', 'kyoto', 'cali', 'rio'];
  const out = {};
  for (const n of names) {
    await page.evaluate((name) => { window.__capy.hud.cross(name); }, n);
    await page.waitForTimeout(4500);
    await page.evaluate(() => {
      const g = window.__capy, w = g.world, bp = w.broadphase;
      const S = { sub: 0, bpMs: [], sortMs: [], nbc: 0, nbcCalls: [], narMs: [], solMs: [], intMs: [], frames: 0 };
      const rawIS = w.internalStep, rawCP = bp.collisionPairs, rawSort = bp.sortList, rawNBC = bp.needBroadphaseCollision, rawGC = w.narrowphase.getContacts, rawSolve = w.solver.solve;
      let nbc = 0;
      bp.needBroadphaseCollision = function (a, b) { nbc++; return rawNBC.call(this, a, b); };
      bp.sortList = function () { const t = performance.now(); const o = rawSort.call(this); S.sortMs.push(performance.now() - t); return o; };
      bp.collisionPairs = function (world, p1, p2) { nbc = 0; const t = performance.now(); const o = rawCP.call(this, world, p1, p2); S.bpMs.push(performance.now() - t); S.nbcCalls.push(nbc); return o; };
      w.narrowphase.getContacts = function () { const t = performance.now(); const o = rawGC.apply(this, arguments); S.narMs.push(performance.now() - t); return o; };
      w.solver.solve = function () { const t = performance.now(); const o = rawSolve.apply(this, arguments); S.solMs.push(performance.now() - t); return o; };
      w.internalStep = function (dt) { const t = performance.now(); const o = rawIS.call(w, dt); S.intMs.push(performance.now() - t); S.sub++; return o; };
      const rawTick = g.tick;
      g.tick = function (dt, r) { const o = rawTick.call(g, dt, r); S.frames++; return o; };
      g.__l4b = { S, rawIS, rawCP, rawSort, rawNBC, rawGC, rawSolve, rawTick };
      const down = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }));
      down('KeyW'); down('ShiftLeft');
    });
    for (let i = 0; i < 2; i++) await page.evaluate(() => new Promise(r => setTimeout(r, 4000)));
    out[n] = await page.evaluate(() => {
      const g = window.__capy, w = g.world, bp = w.broadphase, L = g.__l4b, S = L.S;
      const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }));
      up('KeyW'); up('ShiftLeft');
      w.internalStep = L.rawIS; bp.collisionPairs = L.rawCP; bp.sortList = L.rawSort; bp.needBroadphaseCollision = L.rawNBC; w.narrowphase.getContacts = L.rawGC; w.solver.solve = L.rawSolve; g.tick = L.rawTick;
      const q = (arr, p) => { if (!arr.length) return 0; const s = arr.slice().sort((a, b) => a - b); return +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(2); };
      const mean = arr => arr.length ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) : 0;
      let stat = 0, kin = 0, dyn = 0, dynAwake = 0;
      for (const b of w.bodies) { if (b.type === 2) stat++; else if (b.type === 4) kin++; else { dyn++; if (b.sleepState !== 2) dynAwake++; } }
      return {
        biome: g.biome.current, frames: S.frames, substeps: S.sub, axis: bp.axisIndex,
        internalMs: mean(S.intMs), broadphaseMs: mean(S.bpMs), sortMs: mean(S.sortMs), narrowMs: mean(S.narMs), solveMs: mean(S.solMs),
        nbcPerSub: Math.round(mean(S.nbcCalls)), nbcMax: q(S.nbcCalls, 1),
        bodies: w.bodies.length, stat, kin, dyn, dynAwake,
      };
    });
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l4r-qa-bp.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
