async page => {
  await page.reload();
  await page.waitForTimeout(6000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);
  const out = {};
  for (const n of ['sydney', 'kyoto']) {
    await page.evaluate((name) => { window.__capy.hud.cross(name); }, n);
    await page.waitForTimeout(5000);
    await page.evaluate(() => {
      const g = window.__capy, w = g.world;
      w.doProfiling = true;
      const S = { n: 0, tot: 0, bp: 0, nar: 0, mcc: 0, solve: 0, integ: 0, cmt: 0, sort: 0 };
      const rawIS = w.internalStep, rawCMT = w.collisionMatrixTick, rawSort = w.broadphase.sortList;
      w.collisionMatrixTick = function () { const t = performance.now(); const o = rawCMT.apply(this, arguments); S.cmt += performance.now() - t; return o; };
      w.broadphase.sortList = function () { const t = performance.now(); const o = rawSort.apply(this, arguments); S.sort += performance.now() - t; return o; };
      w.internalStep = function (dt) { const t = performance.now(); const o = rawIS.call(w, dt); S.tot += performance.now() - t; S.n++; S.bp += w.profile.broadphase; S.nar += w.profile.narrowphase; S.mcc += w.profile.makeContactConstraints; S.solve += w.profile.solve; S.integ += w.profile.integrate; return o; };
      g.__l4prof = { S, rawIS, rawCMT, rawSort };
    });
    await page.evaluate(() => new Promise(r => setTimeout(r, 5000)));
    out[n] = await page.evaluate(() => {
      const g = window.__capy, w = g.world, L = g.__l4prof, S = L.S;
      w.internalStep = L.rawIS; w.collisionMatrixTick = L.rawCMT; w.broadphase.sortList = L.rawSort; w.doProfiling = false;
      const f = v => +(v / Math.max(1, S.n)).toFixed(3);
      return { n: S.n, axis: w.broadphase.axisIndex, bodies: w.bodies.length, tot: f(S.tot), bp: f(S.bp), sort: f(S.sort), nar: f(S.nar), mcc: f(S.mcc), solve: f(S.solve), integ: f(S.integ), cmt: f(S.cmt), rest: f(S.tot - S.bp - S.nar - S.mcc - S.solve - S.integ - S.cmt), matrix: w.collisionMatrix.matrix.length };
    });
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l4-bp-prof.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
