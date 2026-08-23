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
    // castle: real input, walking north up the beach
    put(12, 2.0, 20);
    g.input.camYaw = 0;
    window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW',bubbles:true}));
    window.dispatchEvent(new KeyboardEvent('keydown',{code:'ShiftLeft',bubbles:true}));
    for (let i=0;i<330;i++) g.tick(1/60,false);
    window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW',bubbles:true}));
    window.dispatchEvent(new KeyboardEvent('keyup',{code:'ShiftLeft',bubbles:true}));
    log.push(['castle', seen.has('sandcastle'), +g.capy.body.position.z.toFixed(1)]);
    // duck dive
    window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyE',bubbles:true}));
    let mf = 0;
    for (let i=0;i<60*80;i++){
      const p=g.capy.body.position;
      if (p.z > -4 || p.z < -22) { put(0, 0.4, -12); }
      g.tick(1/60,false);
      const w = g.manly.wave(p.x, p.z);
      if (g.capy.diving && (g.capy.depth||0) > 0.8 && w.foam > mf) mf = w.foam;
    }
    window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyE',bubbles:true}));
    log.push(['duck', seen.has('duck-dive'), +mf.toFixed(2)]);
    return {log: log, tasks: [...seen], err: g.state.lastError || null};
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=result.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))});
  }, info);
}
