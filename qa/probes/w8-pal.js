async page => {
  await page.reload(); await page.waitForTimeout(6500);
  await page.mouse.click(500, 400);
  await page.waitForTimeout(2500);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const res = { steps: [] };
    g.state.lastError = null;
    g.biome.switchTo('palawan');
    for (let i=0;i<180;i++) g.tick(1/60,false);
    const b = g.capy.body;
    const put = (x,y,z) => { b.position.set(x,y,z); b.velocity.set(0,0,0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position); };
    // ---- TURTLE: follow her straight through a surfacing.
    // Find the phase where she is about to breathe, then glue to her.
    let n = 0, sawUp = false, best = 0;
    while (n < 60*260 && !g.taskDone('sea-turtle')) {
      // sit exactly on her, one metre under, every frame
      const t = g.palawan.turtle ? g.palawan.turtle() : null;
      if (t) put(t.x, t.y - 0.6, t.z);
      g.tick(1/60,false); n++;
      if (g.palawan.turtleUp && g.palawan.turtleUp()) sawUp = true;
    }
    res.steps.push(['sea-turtle', g.taskDone('sea-turtle'), (n/60).toFixed(1), sawUp]);
    // ---- underwater wheek: no throw, shell runs
    put(-4, -4, -17);
    for (let i=0;i<60;i++) g.tick(1/60,false);
    try { g.events.emit('capy:wheek', { position: g.capy.position }); } catch(e){ res.wheekErr = String(e); }
    for (let i=0;i<300;i++) g.tick(1/60,false);
    res.steps.push(['wheek', !g.state.lastError]);
    // ---- fire: get wet, put it out
    put(2, 0.2, 45);
    for (let i=0;i<240;i++) g.tick(1/60,false);
    put(2, 1.0, 55);
    for (let i=0;i<300;i++) g.tick(1/60,false);
    res.steps.push(['fire', g.taskDone('beach-fire'), +(g.capy.wet||0).toFixed(2)]);
    // ---- long soak, all the systems running
    for (let i=0;i<60*300;i++) g.tick(1/60,false);
    res.lastError = g.state.lastError || null;
    return res;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=w8.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, out);
}
