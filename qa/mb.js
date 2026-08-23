async page => {
  await page.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown', {code:'Space', key:' ', bubbles:true})); });
  await page.waitForTimeout(1200);
  const info = await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('manly');
    const seen = new Set();
    g.events.on('task:complete', e => seen.add(e && e.id));
    const put = (x,y,z) => { g.capy.body.position.set(x,y,z); g.capy.body.velocity.set(0,0,0);
                             g.capy.body.previousPosition.copy(g.capy.body.position);
                             g.capy.body.interpolatedPosition.copy(g.capy.body.position); };
    const log = [];
    // castle at (12, 30.5)
    put(12, 2.0, 22); 
    for (let i=0;i<200;i++){ g.capy.body.velocity.z = 4; g.tick(1/60,false); }
    log.push(['castle', seen.has('sandcastle'), +g.capy.body.position.z.toFixed(1)]);
    // boat: wait for it to be beached and near home
    let waited = 0;
    while (waited < 60*70) { g.tick(1/60,false); waited++;
      const b = g.manly.boat(); if (Math.abs(b.z - 29.5) < 1.5) break; }
    const b0 = g.manly.boat();
    put(b0.x, b0.y + 1.8, b0.z);
    let carried = 0, minz = 99;
    for (let i=0;i<60*60;i++){ g.tick(1/60,false);
      if (g.manly.carryFrame()) carried++;
      const p=g.capy.body.position; if (p.z < minz) minz = p.z; }
    log.push(['boat', seen.has('the-surfboat'), carried, +minz.toFixed(1)]);
    // duck dive: sit just seaward of the break and hold E through several waves
    window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyE',bubbles:true}));
    let maxFoamDeep = 0;
    for (let i=0;i<60*70;i++){
      const p=g.capy.body.position;
      if (p.z > -4 || p.z < -20) { put(0, 0.4, -12); }
      g.tick(1/60,false);
      const c = g.capy;
      if (c.diving && (c.depth||0) > 0.8) {
        // sample the foam where it is
        const s = g.manly; // no direct foam getter; use flow magnitude proxy
        maxFoamDeep = Math.max(maxFoamDeep, c.depth||0);
      }
    }
    window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyE',bubbles:true}));
    log.push(['duck', seen.has('duck-dive'), +maxFoamDeep.toFixed(2)]);
    return {log: log, tasks: [...seen], err: g.state.lastError || null};
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=result.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))});
  }, info);
}
