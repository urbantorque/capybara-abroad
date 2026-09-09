async page => {
  await page.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown', {code:'Space', key:' ', bubbles:true})); });
  await page.waitForTimeout(1400);
  const info = await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('cave');
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

    // 1. first echo in the dark
    put(6, -3, -20); run(30); press('KeyQ'); run(30);
    log.push(['echo', seen.has('first-echo')]);
    // 2. glow trail: reach the river
    put(-20, -8, 10); run(60);
    log.push(['trail', seen.has('glow-trail')]);
    // 3. swim it
    put(-20, -7, 30);
    for (let i=0;i<60*30;i++){ g.tick(1/60,false);
      const p=g.capy.body.position; if (p.z < -80) put(-20,-7,30); }
    log.push(['river', seen.has('cave-river'), +g.capy.body.position.z.toFixed(1)]);
    // 4. hand of dog
    put(16, g.cave.terrainHeight(16,-4) + 27, -4); run(90);
    log.push(['hand', seen.has('hand-of-dog')]);
    // 5. swiftlets
    put(-30, g.cave.terrainHeight(-30,-126)+1, -126); run(40);
    for (let k=0;k<4;k++){ press('KeyQ'); run(80); }
    log.push(['swifts', seen.has('swiftlets')]);
    // 6. pearls
    put(22, g.cave.terrainHeight(22,-132)+1, -132); run(30); press('KeyE'); run(20);
    log.push(['pearls', seen.has('cave-pearl')]);
    // 7. blind fish
    for (let i=0;i<60*30 && !seen.has('blind-fish'); i++){
      const f = g.cave.fish(); put(f.x, f.y, f.z + 1.5); g.tick(1/60,false);
    }
    log.push(['fish', seen.has('blind-fish')]);
    // 8. doline
    put(4, g.cave.terrainHeight(4,-48)+1, -48); run(60);
    log.push(['doline', seen.has('the-doline'), +g.cave.daylight().toFixed(2)]);
    // 9. phytokarst
    put(-12, g.cave.terrainHeight(-12,-34)+1, -34); run(30);
    log.push(['phyto', seen.has('phytokarst')]);
    // 10. the log
    for (let i=0;i<60*90 && !seen.has('the-log'); i++){
      const l = g.cave.log(); put(l.x, l.y + 1.2, l.z); g.tick(1/60,false);
    }
    log.push(['log', seen.has('the-log')]);
    // 11. the wall: climb it with E held against the face
    put(0, g.cave.terrainHeight(0,-96)+1, -96); run(60);
    window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyE',bubbles:true}));
    window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW',bubbles:true}));
    let maxY = -99;
    for (let i=0;i<60*40;i++){ g.tick(1/60,false);
      const p = g.capy.body.position; if (p.y > maxY) maxY = p.y; }
    window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyE',bubbles:true}));
    window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW',bubbles:true}));
    log.push(['wall', seen.has('great-wall'), +maxY.toFixed(1),
              +g.capy.body.position.z.toFixed(1), g.capy.climbing?1:0]);
    return {log: log, tasks: [...seen], err: g.state.lastError || null};
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=result.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))});
  }, info);
}
