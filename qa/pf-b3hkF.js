async page => {
  const out = await page.evaluate(() => {
    const g = window.__capy, o = {};
    g.biome.switchTo('kowloon');
    const b = g.capy.body, sp = g.biome.spawnOf('kowloon'), inp = g.input, k = g.kowloon;
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    let loafAt = -1, t = 0;
    const bus0 = Object.assign({}, k.bus()), lion0 = Object.assign({}, k.lion());
    let busMoved = 0, lionMax = 0;
    for (let i=0;i<60*70;i++) {
      inp.x=0; inp.z=0; inp.action=false; inp.run=false; inp.jump=false;
      g.tick(1/60,false); t += 1/60;
      if (loafAt < 0 && g.capy.loaf) loafAt = +t.toFixed(1);
      const bp = k.bus(); busMoved = Math.max(busMoved, Math.hypot(bp.x-bus0.x, bp.z-bus0.z));
      const lp = k.lion(); lionMax = Math.max(lionMax, lp.y);
    }
    o.loafAt = loafAt;
    o.busMoved = +busMoved.toFixed(1);
    o.lionMaxY = +lionMax.toFixed(2);
    o.ferryMoved = (function(){ const f0=Object.assign({},k.ferry()); let m=0;
      for(let i=0;i<60*60;i++){ inp.x=0;inp.z=0; g.tick(1/60,false); const f=k.ferry();
        m=Math.max(m,Math.hypot(f.x-f0.x,f.z-f0.z)); } return +m.toFixed(1); })();
    // surface pitch across the chapter's real standable surfaces
    o.pitch = {
      street: k.surfacePitch(0, 20, 0.35),
      pavement: k.surfacePitch(-9, 20, 0.35),
      market: k.surfacePitch(k.market.x, k.market.z, 0.35),
      pier: k.surfacePitch(0, -70, 0.35),
      busTop: k.surfacePitch(0, 10, 4.2),
      neonSign: k.surfacePitch(k.sign.x, k.sign.z, k.sign.y + 0.4),
      poles: k.surfacePitch(0, 5, 11.6),
      scafDeck: k.surfacePitch(-9, 0, 11.6),
      roof: k.surfacePitch(-19, 0, 34.5)
    };
    o.roofHintHasY = (typeof k.roof.y === 'number');
    o.signHintHasY = (typeof k.sign.y === 'number');
    return o;
  });
  await page.evaluate(async (d) => {
    await fetch('/shot?name=b3hkF.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(d)))) });
  }, out);
}
