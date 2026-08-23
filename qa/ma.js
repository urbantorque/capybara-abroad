async page => {
  await page.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown', {code:'Space', key:' ', bubbles:true})); });
  await page.waitForTimeout(1200);
  const info = await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('manly');
    const out = {boat: [], duck: [], rip: []};
    const put = (x,y,z) => { g.capy.body.position.set(x,y,z); g.capy.body.velocity.set(0,0,0);
                             g.capy.body.previousPosition.copy(g.capy.body.position);
                             g.capy.body.interpolatedPosition.copy(g.capy.body.position); };
    // boat
    put(-14, 2.4, 29.5);
    for (let i=0;i<60*45;i++){
      g.tick(1/60,false);
      if (i%60===0){ const b=g.manly.boat(); const p=g.capy.body.position;
        out.boat.push([i/60, +b.z.toFixed(1), +b.y.toFixed(2), +p.x.toFixed(1), +p.y.toFixed(2), +p.z.toFixed(1), !!g.manly.carryFrame()]); }
    }
    // duck dive
    put(0, 0.6, -8);
    window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyE',bubbles:true}));
    for (let i=0;i<60*24;i++){
      g.tick(1/60,false);
      const p=g.capy.body.position;
      if (p.z>16){ p.set(0,0.6,-8); g.capy.body.velocity.set(0,0,0); }
      if (i%30===0){ const c=g.capy; out.duck.push([i/60, +p.z.toFixed(1), +p.y.toFixed(2), c.diving?1:0, +(c.depth||0).toFixed(2)]); }
    }
    window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyE',bubbles:true}));
    // rip
    put(-34, 0.6, 12);
    for (let i=0;i<60*30;i++){ g.tick(1/60,false);
      if (i%60===0){const p=g.capy.body.position; out.rip.push([i/60, +p.x.toFixed(1), +p.z.toFixed(1), +g.manly.flow(p.x,p.z).z.toFixed(2)]);} }
    return out;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=result.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))});
  }, info);
}
