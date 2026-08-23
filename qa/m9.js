async page => {
  await page.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown', {code:'Space', key:' ', bubbles:true})); });
  await page.waitForTimeout(1200);
  const info = await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('manly');
    const seen = new Set();
    g.events.on('task:complete', e => seen.add(e && e.id));
    const log = [];
    const put = (x,y,z) => { g.capy.body.position.set(x,y,z); g.capy.body.velocity.set(0,0,0);
                             g.capy.body.previousPosition.copy(g.capy.body.position);
                             g.capy.body.interpolatedPosition.copy(g.capy.body.position); };
    const run = (n) => { for (let i=0;i<n;i++) g.tick(1/60,false); };
    const press = (code) => { window.dispatchEvent(new KeyboardEvent('keydown',{code:code,bubbles:true}));
                              g.tick(1/60,false);
                              window.dispatchEvent(new KeyboardEvent('keyup',{code:code,bubbles:true}));
                              g.tick(1/60,false); };
    // 1. pine cone: walk to the pine row and press E
    put(0, 3.4, 39.5); run(20); press('KeyE'); run(60);
    log.push(['cone', seen.has('pine-cone')]);
    // 2. sandcastle: run into it
    put(12, 1.5, 18); run(10);
    for (let i=0;i<120;i++){ g.capy.body.velocity.z = 5; g.tick(1/60,false); }
    log.push(['castle', seen.has('sandcastle'), +g.capy.body.position.z.toFixed(1)]);
    // 3. flags: grab / plant
    put(0.5, 1.4, 30); run(30); press("KeyE"); run(10);
    const held = g.manly.rideDist; // dummy
    put(-20, 1.2, 30); run(120); press('KeyE'); run(60*10);
    log.push(['flags', seen.has('move-flags')]);
    // 4. pool
    put(65, 1.0, 21); run(60);
    for (let i=0;i<60*8;i++){ g.capy.body.velocity.z = -2.4; g.tick(1/60,false); }
    log.push(['pool', seen.has('bower-pool'), +g.capy.body.position.z.toFixed(1)]);
    // 5. groper
    put(76, 0.5, -20); run(60*12);
    log.push(['groper', seen.has('blue-groper')]);
    // 6. bommie
    put(40, 1.0, -46); run(60*20);
    log.push(['bommie', seen.has('the-bommie')]);
    // 7. rip
    put(-34, 1.0, 12); run(60*40);
    log.push(['rip', seen.has('the-rip'), +g.capy.body.position.z.toFixed(1)]);
    // 8. surfboat: sit in it and wait
    put(-14, 2.5, 29.5); run(60*45);
    log.push(['boat', seen.has('the-surfboat'), +g.capy.body.position.z.toFixed(1)]);
    // 9. duck dive: hold E in the surf
    put(0, 0.6, -6);
    window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyE',bubbles:true}));
    for (let i=0;i<60*25;i++){ g.tick(1/60,false);
      const p=g.capy.body.position; if (p.z>18) { p.set(0,0.6,-6); g.capy.body.velocity.set(0,0,0);} }
    window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyE',bubbles:true}));
    log.push(['duck', seen.has('duck-dive')]);
    return {log: log, tasks: [...seen], err: g.state.lastError || null};
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=result.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))});
  }, info);
}
