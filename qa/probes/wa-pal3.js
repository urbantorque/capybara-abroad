async page => {
  await page.reload(); await page.waitForTimeout(6500);
  await page.mouse.click(500, 400);
  await page.waitForTimeout(2500);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const res = { steps: [] };
    g.biome.switchTo('palawan');
    for (let i=0;i<180;i++) g.tick(1/60,false);
    const b = g.capy.body;
    const th = g.palawan.terrainHeight;
    const put = (x,y,z) => { b.position.set(x,y,z); b.velocity.set(0,0,0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position); };
    // swim properly: out past the shelf
    put(2, 0.4, 10);
    for (let i=0;i<60*10;i++) g.tick(1/60,false);
    res.steps.push(['wet', +(g.capy.wet||0).toFixed(2), +g.capy.position.y.toFixed(2), +th(2,10).toFixed(2)]);
    put(2, th(2,55)+0.6, 55);
    for (let i=0;i<60*4;i++) g.tick(1/60,false);
    res.steps.push(['fire', g.taskDone('beach-fire'), +(g.capy.wet||0).toFixed(2)]);

    // ---- THE TURTLE ACROSS HER OWN BREATH ------------------------------
    // Drive her clock to just before the surfacing, then follow.
    // palTurtleT is private, so drive real time and watch turtleUp via y.
    let started = -1, sawUp = false, ticks = 0;
    const tp = () => g.palawan.turtle ? g.palawan.turtle() : null;
    // wait until she is 4 s from surfacing: detect by her y climbing
    let prevY = 0;
    while (ticks < 60*400) {
      const t = tp(); if (!t) break;
      // hold station on her the whole time
      put(t.x, t.y - 0.7, t.z);
      g.tick(1/60,false); ticks++;
      const t2 = tp();
      if (t2 && t2.y > -0.6) sawUp = true;
      if (g.taskDone('sea-turtle') && started < 0) started = ticks;
      if (sawUp && started > 0) break;
      prevY = t2 ? t2.y : 0;
    }
    res.steps.push(['turtle-through-breath', g.taskDone('sea-turtle'), sawUp, (ticks/60).toFixed(1)]);
    res.lastError = g.state.lastError || null;
    return res;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=wa.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, out);
}
