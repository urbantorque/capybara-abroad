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

    // ---- jump apex from flat sand ---------------------------------------
    park(0, r.terrainHeight(0,-8)+0.3, -8);
    for (let i=0;i<40;i++) g.tick(1/60,false);
    const y0 = g.capy.position.y; let apex = y0;
    g.input.jumpPressed = true; g.input.jumpBuf = 0; g.tick(1/60,false);
    g.input.jumpPressed = false;
    for (let i=0;i<100;i++) { g.tick(1/60,false); if (g.capy.position.y>apex) apex=g.capy.position.y; }
    o.jumpRise = +(apex - y0).toFixed(2);

    // ---- can the animal stand ON the counter at all? --------------------
    park(r.kiosk.x, 2.6, r.kiosk.z + 0.2);
    for (let i=0;i<90;i++) g.tick(1/60,false);
    o.onCounterY = +g.capy.position.y.toFixed(2);

    // ---- the arches deck: solid under the feet? -------------------------
    for (const x of [-40,-28,-14,0,4,14,26,38]) {
      park(x, 22, 77.55);
      for (let i=0;i<180;i++) g.tick(1/60,false);
      (o.deck = o.deck || []).push([x, +g.capy.position.y.toFixed(2)]);
    }

    // ---- o-bonde: stand on tram 0 and soak ------------------------------
    const s0 = g.state.score;
    const bp = r.bonde();
    park(bp.x, bp.y + 1.1, bp.z);
    let boarded = 0, maxY = -99;
    for (let i=0;i<60*70;i++) {
      const p = r.bonde();
      // ride: glue to the tram so a headless run does not slide off
      const b = g.capy.body;
      b.position.set(p.x, p.y + 1.0, b.position.z);
      b.velocity.set(0,0,0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      g.tick(1/60,false);
      if (g.capy.position.y > maxY) maxY = g.capy.position.y;
      if (g.state.score > s0) { boarded = i/60; break; }
    }
    o.bondeFiredAfterS = +boarded.toFixed(1);
    o.bondeMaxY = +maxY.toFixed(2);
    o.scoreDelta = g.state.score - s0;

    // ---- walkable route sampling: along the sand, and up to the avenue --
    o.walk = [];
    const legs = [
      ['sand W to arpoador', -8,-8, -60,-14],
      ['sand E to station',  -8,-8,  56,-16],
      ['front to avenue',      0,-2,   0,46],
      ['avenue to selaron',  -20,46, -20,84],
    ];
    const locals = g.locals.filter(x=>x.biome==='rio');
    for (const [nm,x0,z0,x1,z1] of legs) {
      const L = Math.hypot(x1-x0,z1-z0), n = Math.max(1, Math.round(L/20));
      for (let i=0;i<n;i++) {
        const t=(i+0.5)/n, x=x0+(x1-x0)*t, z=z0+(z1-z0)*t;
        let solid=0;
        for (let a=0;a<24;a++){const ang=a/24*Math.PI*2;
          for(let rr=2;rr<=12;rr+=2) if (r.navBlocked(x+Math.cos(ang)*rr,z+Math.sin(ang)*rr,0.4)){solid++;break;}}
        let nl=1e9; for(const l of locals) nl=Math.min(nl,Math.hypot(l.x-x,l.z-z));
        o.walk.push({leg:nm,x:+x.toFixed(0),z:+z.toFixed(0),solid,nearLocal:+nl.toFixed(1),
                     terr:+r.terrainHeight(x,z).toFixed(1)});
      }
    }
    o.err = g.state.lastError || null;
    return o;
  });
  await page.evaluate((o) => fetch('/shot?name=rio6.json', { method:'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out);
}
