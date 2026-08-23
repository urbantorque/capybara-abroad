async page => {
  await page.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown', {code:'Space', key:' ', bubbles:true})); });
  await page.waitForTimeout(1400);
  const info = await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('pantanal');
    const seen = new Set();
    g.events.on('task:complete', e => seen.add(e && e.id));
    const log = [];
    const put = (x,y,z) => { g.capy.body.position.set(x,y,z); g.capy.body.velocity.set(0,0,0);
      g.capy.body.previousPosition.copy(g.capy.body.position);
      g.capy.body.interpolatedPosition.copy(g.capy.body.position); };
    const run = n => { for (let i=0;i<n;i++) g.tick(1/60,false); };
    const press = c => { window.dispatchEvent(new KeyboardEvent('keydown',{code:c,bubbles:true}));
      g.tick(1/60,false);
      window.dispatchEvent(new KeyboardEvent('keyup',{code:c,bubbles:true})); g.tick(1/60,false); };

    // camalote: hop along the actual mats
    const n = g.pantanal.matCount();
    for (let k = 0; k < n; k++) {
      const m = g.pantanal.matAt(k);
      put(m.x, m.y + 1.1, m.z);
      run(28);
    }
    log.push(['camalote', seen.has('camalote'), n]);

    // cowbird
    put(12, 2.0, 30); run(60*32);
    log.push(['cowbird', seen.has('cowbird')]);

    // the crossing: gather 5, then take them into the river
    put(-14, 2.5, 34); run(45);
    for (let k=0;k<7;k++){ press('KeyQ'); run(40); }
    const following = g.pantanal.following();
    // walk them down to the crossing in short teleport steps so the trail is real
    let x = -14, z = 34;
    while (z > -52) { z -= 0.5; x += (-34 - x) * 0.012; put(x, 2.2, z); g.tick(1/60,false); }
    log.push(['at bank', g.pantanal.following()]);
    while (z > -86) { z -= 0.16; put(x, Math.max(1.0, g.pantanal.terrainHeight(x,z)+0.8), z); g.tick(1/60,false); }
    run(120);
    log.push(['crossing', seen.has('the-crossing'), g.pantanal.following(), +g.pantanal.dusk().toFixed(2)]);
    return {log: log, tasks: [...seen], err: g.state.lastError || null, following: following};
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=result.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))});
  }, info);
}
