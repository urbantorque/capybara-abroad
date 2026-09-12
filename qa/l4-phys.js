async page => {
  await page.reload();
  await page.waitForTimeout(6000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);
  const names = ['sydney', 'rio', 'cali', 'iceland', 'kyoto', 'monaco', 'sahara', 'antarctic', 'venice', 'hanoi'];
  const out = {};
  for (const n of names) {
    await page.evaluate((name) => { window.__capy.hud.cross(name); }, n);
    await page.waitForTimeout(4500);
    await page.evaluate(() => {
      const g = window.__capy, w = g.world;
      const S = { sub: 0, subMs: [], pairs: [], nar: [], narMs: [], hfPairs: 0, hfSub: 0, frames: 0, sleeping: 0, awake: 0 };
      const rawIS = w.internalStep, rawCP = w.broadphase.collisionPairs, rawGC = w.narrowphase.getContacts;
      w.internalStep = function (dt) { const t = performance.now(); const o = rawIS.call(w, dt); S.subMs.push(performance.now() - t); S.sub++; return o; };
      w.broadphase.collisionPairs = function (world, p1, p2) {
        const o = rawCP.call(this, world, p1, p2);
        S.pairs.push(p1.length);
        let hf = 0;
        for (let i = 0; i < p1.length; i++) { const a = p1[i], b = p2[i]; if ((a.shapes[0] && a.shapes[0].constructor.name === 'Heightfield') || (b.shapes[0] && b.shapes[0].constructor.name === 'Heightfield')) hf++; }
        S.hfPairs += hf; S.hfSub++;
        return o;
      };
      w.narrowphase.getContacts = function () { const t = performance.now(); const o = rawGC.apply(this, arguments); S.narMs.push(performance.now() - t); S.nar.push(w.contacts.length); return o; };
      const rawTick = g.tick;
      g.tick = function (dt, r) { const o = rawTick.call(g, dt, r); S.frames++; return o; };
      g.__l4p = { S, rawIS, rawCP, rawGC, rawTick };
      const down = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }));
      down('KeyW'); down('ShiftLeft');
    });
    for (let i = 0; i < 2; i++) await page.evaluate(() => new Promise(r => setTimeout(r, 5000)));
    out[n] = await page.evaluate(() => {
      const g = window.__capy, w = g.world, L = g.__l4p, S = L.S;
      const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }));
      up('KeyW'); up('ShiftLeft');
      w.internalStep = L.rawIS; w.broadphase.collisionPairs = L.rawCP; w.narrowphase.getContacts = L.rawGC; g.tick = L.rawTick;
      const q = (arr, p) => { if (!arr.length) return 0; const s = arr.slice().sort((a, b) => a - b); return +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(2); };
      const mean = arr => arr.length ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) : 0;
      let awake = 0, hfN = 0, hfInfo = null;
      for (const b of w.bodies) { if (b.sleepState !== 2 && b.mass > 0) awake++; const s = b.shapes[0]; if (s && s.constructor.name === 'Heightfield') { hfN++; hfInfo = { rows: s.data.length, cols: s.data[0].length, el: s.elementSize, minV: s.minValue, maxV: s.maxValue }; } }
      return {
        biome: g.biome.current, frames: S.frames, substeps: S.sub, subPerFrame: +(S.sub / Math.max(1, S.frames)).toFixed(2),
        subMs: { mean: mean(S.subMs), p95: q(S.subMs, 0.95), max: q(S.subMs, 1) },
        narMs: { mean: mean(S.narMs), p95: q(S.narMs, 0.95) },
        pairsMean: mean(S.pairs), pairsMax: q(S.pairs, 1), hfPairsPerSub: +(S.hfPairs / Math.max(1, S.hfSub)).toFixed(1),
        contactsMean: mean(S.nar), bodies: w.bodies.length, awakeDyn: awake, heightfield: hfInfo,
        solverIter: w.solver.iterations,
      };
    });
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l4-phys.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
