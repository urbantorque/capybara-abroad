async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch(e){} });
  await page.reload();
  await page.waitForTimeout(7000);
  const out = await page.evaluate(() => {
    const g = window.__capy, o = {};
    g.biome.switchTo('kowloon');
    const sp = g.biome.spawnOf('kowloon'), b = g.capy.body;
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    for (let i=0;i<120;i++) g.tick(1/60,false);
    const k = g.kowloon;
    o.api = Object.keys(k);
    o.spawn = { x: sp.x, y: sp.y, z: sp.z };
    o.scaf = k.scaffold; o.roof = k.roof; o.poles = k.poles; o.sign = k.sign;
    o.pier = k.pier; o.bakery = k.bakery; o.market = k.market;
    // ---- the show clock: how long is it on, how long between shows
    const samples = [];
    let on = false, onAt = -1, offAt = -1, t = 0;
    let firstOn = -1, secondOn = -1;
    for (let i=0;i<152*60+400;i++) {
      g.tick(1/60,false); t += 1/60;
      const s = k.showing();
      if (s && !on) { on = true; if (firstOn<0) firstOn = t; else if (secondOn<0) secondOn = t; onAt = t; }
      if (!s && on) { on = false; offAt = t; samples.push(+(offAt-onAt).toFixed(2)); }
    }
    o.showWindows = samples;
    o.showPeriod = (secondOn>0 && firstOn>0) ? +(secondOn-firstOn).toFixed(1) : null;
    return o;
  });
  await page.evaluate(async (d) => {
    await fetch('/shot?name=b3hk1.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(d)))) });
  }, out);
}
