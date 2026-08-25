async page => {
  const out = await page.evaluate(() => {
    const g = window.__capy, P = g.physics;
    const r = {};
    function eat(biome, type) {
      if (g.biome.current !== biome) g.biome.switchTo(biome);
      const sp = g.biome.spawnOf(biome), cb = g.capy.body;
      cb.position.set(sp.x, sp.y, sp.z); cb.velocity.set(0, 0, 0);
      cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position);
      for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
      const p = g.props.find(q => q.type === type && !q.removed && !q.hidden);
      if (!p) return { err: 'no ' + type + ' in ' + biome };
      const homeBefore = [+p.homeX.toFixed(2), +p.homeY.toFixed(2), +p.homeZ.toFixed(2)];
      cb.position.set(p.body.position.x + 0.4, cb.position.y, p.body.position.z);
      cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position);
      for (let i = 0; i < 10; i++) g.tick(1 / 60, false);
      const grabbed = P.grab(p);
      let tHide = -1;
      for (let i = 0; i < 900 && !p.hidden; i++) { g.tick(1 / 60, false); if (p.hidden) tHide = i / 60; }
      const t0 = g.state.time;
      const parked = [+p.body.position.x.toFixed(2), +p.body.position.y.toFixed(2), +p.body.position.z.toFixed(2)];
      // 60 s of simulated time in the chapter it was eaten in — physGRAZE_BACK is 34
      for (let i = 0; i < 60 * 60 && p.hidden; i++) g.tick(1 / 60, false);
      const stillHidden = !!p.hidden;
      const waited = +(g.state.time - t0).toFixed(1);
      // ...and now go to Pasto, where the restock loop actually runs
      g.biome.switchTo('pasto');
      for (let i = 0; i < 300 && p.hidden; i++) g.tick(1 / 60, false);
      const hiddenAfterPasto = !!p.hidden;
      return { biome, type, grabbed, homeBefore, secondsToHide: +tHide.toFixed(2),
               parked, hiddenAfter60s: stillHidden, waited,
               hiddenAfterPastoVisit: hiddenAfterPasto,
               hiddenUntil: +p.hiddenUntil.toFixed(1), timeNow: +g.state.time.toFixed(1),
               grabbableNow: !!p.grabbable, meshVisible: !!p.mesh.visible };
    }
    r.quayChips = eat('quay', 'chips');
    r.sydneySandwich = eat('sydney', 'sandwich');
    return r;
  });
  await page.evaluate(async o => {
    await fetch('/shot?name=b4fz-5.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out);
}
