async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch(e){} });
  await page.reload();
  await page.waitForTimeout(6000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(3000);
  const out = await page.evaluate(() => {
    const g = window.__capy; const o = {};
    const park = (x,y,z) => { const b=g.capy.body; b.position.set(x,y,z); b.velocity.set(0,0,0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position); };
    g.biome.switchTo('rio'); park(0,1.4,0);
    for (let i=0;i<150;i++) g.tick(1/60,false);
    const r = g.rio;
    o.localWater = r.localWater === undefined ? 'ABSENT' : r.localWater;
    o.waterLevel = r.waterLevel;

    // ---- the wave: is the surface under the animal the drawn one? --------
    // find the crest of a live wave and stand on it
    let best = null;
    for (let t=0;t<3000;t++) {
      g.tick(1/60,false);
      const w = r.waveAt();
      if (w.z > -70 && w.z < -25) { best = { x: w.x, z: w.z }; break; }
    }
    o.waveFound = best;
    if (best) {
      o.waterHeightAtCrest = +r.waterHeightAt(best.x, best.z).toFixed(3);
      o.flatLevel = r.waterLevel;
      park(best.x, 0.2, best.z);
      for (let i=0;i<90;i++) g.tick(1/60,false);
      o.capyYinSea = +g.capy.position.y.toFixed(3);
      o.surfaceNow = +r.waterHeightAt(g.capy.position.x, g.capy.position.z).toFixed(3);
    }

    // ---- auto-loaf ------------------------------------------------------
    park(0, 1.4, 0);
    for (let i=0;i<60;i++) g.tick(1/60,false);
    let loafAt = -1;
    for (let i=0;i<60*120;i++) { g.tick(1/60,false); if (g.capy.loaf > 0.5) { loafAt = i/60; break; } }
    o.loafAfterS = +loafAt.toFixed(1);

    // ---- route life: 20 m cells along the route -------------------------
    const legs = [
      ['beach->selaron', 0,0, -20,84],
      ['beach->avenue', 0,0, 0,46],
      ['beach->station', 0,-4, 58,-24],
      ['beach->arpoador', 0,-4, -62,-26],
      ['selaron->arches', -20,84, 4,77.5],
      ['arches->terminus', 4,77.5, 38,77.5],
    ];
    const locals = g.locals.filter(x => x.biome === 'rio');
    o.nLocals = locals.length;
    o.cells = [];
    for (const [nm,x0,z0,x1,z1] of legs) {
      const L = Math.hypot(x1-x0, z1-z0);
      const n = Math.max(1, Math.round(L/20));
      for (let i=0;i<n;i++) {
        const t = (i+0.5)/n, x = x0+(x1-x0)*t, z = z0+(z1-z0)*t;
        let solid = 0;
        for (let a=0;a<24;a++) { const ang=a/24*Math.PI*2;
          for (let rr=2; rr<=12; rr+=2)
            if (r.navBlocked(x+Math.cos(ang)*rr, z+Math.sin(ang)*rr, 0.4)) { solid++; break; } }
        let nl = 1e9; for (const l of locals) nl = Math.min(nl, Math.hypot(l.x-x, l.z-z));
        o.cells.push({ leg:nm, x:+x.toFixed(0), z:+z.toFixed(0), solid, nearLocal:+nl.toFixed(1),
                       terr:+r.terrainHeight(x,z).toFixed(1) });
      }
    }
    o.err = g.state.lastError || null;
    return o;
  });
  await page.evaluate((o) => fetch('/shot?name=rio5.json', { method:'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out);
}
