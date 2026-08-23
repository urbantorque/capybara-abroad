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

    // 1. meet the locals + gather: stand near them and wheek repeatedly
    put(-14, 2.5, 34); run(60);
    log.push(['locals', seen.has('the-locals')]);
    for (let k=0;k<9;k++){ press('KeyQ'); run(45); }
    log.push(['following', g.pantanal.following(), seen.has('gather')]);

    // 2. the herd follows: walk and check the line
    for (let k=0;k<8;k++){
      const p = g.capy.body.position;
      put(p.x + 4, 2.5, p.z - 4); run(30);
    }
    log.push(['still following', g.pantanal.following()]);

    // 3. camalote: hop the mats east->west
    const mats = [];
    put(-16, 2.0, 6);
    for (let k=0;k<11;k++){
      const t = k/10;
      const x = -16 + (-95 - (-16)) * t * 0; // placeholder
    }
    // walk the mat line by teleporting to each mat centre
    for (let k=0;k<11;k++){
      const t = k/10;
      const x = (-55 + 40 - 4) + ((-55 - 40 + 4) - (-55 + 40 - 4)) * t;
      const z = 6 + Math.sin(t*3.1)*9;
      put(x, 1.6, z); run(35);
    }
    log.push(['camalote', seen.has('camalote')]);

    // 4. caiman nap
    put(34, 2.0, -68); run(90);
    const c = g.pantanal.caiman();
    put(c.x, c.y + 1.0, c.z); run(90);
    log.push(['caiman', seen.has('caiman-nap')]);

    // 5. jabiru nest — teleport up the tree
    put(50, 9.0, 18); run(60);
    log.push(['nest', seen.has('jabiru-nest')]);

    // 6. macaw nut
    put(-19, 2.0, -28); run(30); press('KeyE'); run(30);
    log.push(['macaw', seen.has('macaw-nut')]);

    // 7. otters
    put(-54, 1.0, -66); run(60*4);
    log.push(['otters', seen.has('the-otters')]);

    // 8. missing plank: hop it
    put(g.pantanal.bridge.x, 2.6, -24);
    window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW',bubbles:true}));
    for (let i=0;i<300;i++){ g.tick(1/60,false);
      const p = g.capy.body.position;
      if (Math.abs(p.z + 22) < 0.6) window.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',bubbles:true}));
      if (Math.abs(p.z + 21) < 0.6) window.dispatchEvent(new KeyboardEvent('keyup',{code:'Space',bubbles:true}));
    }
    window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW',bubbles:true}));
    log.push(['plank', seen.has('missing-plank'), +g.capy.body.position.z.toFixed(1)]);

    // 9. cowbird: stand still
    put(12, 2.0, 30);
    run(60*30);
    log.push(['cowbird', seen.has('cowbird')]);

    // 10. anteater
    let found = 0;
    for (let i=0;i<60*90 && !seen.has('tamandua'); i++){
      const a = g.pantanal.anteater();
      put(a.x, a.y + 1.6, a.z + 0.2);
      g.tick(1/60,false);
      found++;
    }
    log.push(['anteater', seen.has('tamandua'), found]);

    return {log: log, tasks: [...seen], err: g.state.lastError || null};
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=result.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))});
  }, info);
}
