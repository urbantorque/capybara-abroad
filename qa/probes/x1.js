async page => {
  await page.waitForFunction(() => !!window.__capy && !!window.__capy.biome, null, {timeout: 25000});
  await page.waitForTimeout(900);
  await page.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',key:' ',bubbles:true})); });
  await page.waitForTimeout(1800);
  const info = await page.evaluate(() => {
    const g = window.__capy;
    const out = {arrive: [], exit: [], err: null};
    const seen = new Set();
    g.events.on('task:complete', e => seen.add(e && e.id));
    const run = n => { for (let i=0;i<n;i++) g.tick(1/60,false); };
    const press = c => { window.dispatchEvent(new KeyboardEvent('keydown',{code:c,bubbles:true}));
      g.tick(1/60,false);
      window.dispatchEvent(new KeyboardEvent('keyup',{code:c,bubbles:true})); g.tick(1/60,false); };
    const put = (x,y,z) => { g.capy.body.position.set(x,y,z); g.capy.body.velocity.set(0,0,0);
      g.capy.body.previousPosition.copy(g.capy.body.position);
      g.capy.body.interpolatedPosition.copy(g.capy.body.position); };

    const chapters = [
      ['manly', 'to-manly'], ['pantanal', 'to-pantanal'], ['cave', 'to-cave'],
    ];
    for (const [b, id] of chapters) {
      g.biome.switchTo(b);
      const s = g.biome.spawnOf(b);
      put(s.x, s.y, s.z);
      run(120);
      out.arrive.push([b, seen.has(id)]);
    }
    // ---- the exits. Stand at each and wheek three times. ----
    // Manly: between the flags, once the set has been seen
    g.biome.switchTo('manly');
    put(6, 2.0, 30); run(60);
    // fast-forward the sea until the big one has come round
    for (let i=0;i<60*90 && !g.manly.seenSet(); i++) g.tick(1/60,false);
    put(6, 2.0, 30); run(60);
    let homeEl = document.querySelector('.capyui-home');
    out.exit.push(['manly-prompt', !!(homeEl && homeEl.classList.contains('show')), g.manly.seenSet()]);
    press('KeyQ'); run(10); press('KeyQ'); run(10); press('KeyQ'); run(20);
    out.exit.push(['manly-board', document.querySelector('.capyui-jr').classList.contains('show')]);
    window.dispatchEvent(new KeyboardEvent('keydown',{code:'Escape',bubbles:true}));
    run(20);

    g.biome.switchTo('pantanal');
    const bz = -96, bx = 0;
    put(bx, 3.0, bz); run(60);
    homeEl = document.querySelector('.capyui-home');
    out.exit.push(['pantanal-prompt', !!(homeEl && homeEl.classList.contains('show'))]);
    press('KeyQ'); run(10); press('KeyQ'); run(10); press('KeyQ'); run(20);
    out.exit.push(['pantanal-board', document.querySelector('.capyui-jr').classList.contains('show')]);
    window.dispatchEvent(new KeyboardEvent('keydown',{code:'Escape',bubbles:true}));
    run(20);

    g.biome.switchTo('cave');
    // stand in the doline first so seenLight() is true
    put(4, g.cave.terrainHeight(4,-48)+1, -48); run(90);
    put(0, g.cave.terrainHeight(0,-166)+1, -166); run(90);
    homeEl = document.querySelector('.capyui-home');
    out.exit.push(['cave-prompt', !!(homeEl && homeEl.classList.contains('show')), g.cave.seenLight()]);
    press('KeyQ'); run(10); press('KeyQ'); run(10); press('KeyQ'); run(20);
    out.exit.push(['cave-board', document.querySelector('.capyui-jr').classList.contains('show')]);
    out.err = g.state.lastError || null;
    out.tasks = [...seen];
    return out;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=result.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))});
  }, info);
}
