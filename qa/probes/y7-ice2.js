async page => {
  await page.reload(); await page.waitForTimeout(5600);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2200);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const res = {};
    g.biome.switchTo('iceland');
    for (let i=0;i<600;i++) g.tick(1/60,false);
    res.locals = g.npcs ? undefined : undefined;
    // whale: park on the pier and see how long until the mini ticks
    const I = g.iceland;
    const b = g.capy.body;
    const hold = (x,y,z) => { b.position.set(x,y,z); b.velocity.set(0,0,0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position); };
    hold(I.pier.x, 2.2, I.pier.z);
    let f = 0;
    while (f < 60*140 && !g.taskDone('the-whale')) { hold(I.pier.x, 2.2, I.pier.z); g.tick(1/60,false); f++; }
    res.whaleSeconds = +(f/60).toFixed(1);
    res.whaleDone = g.taskDone('the-whale');
    // soak
    hold(I.spring.x, 0.2, I.spring.z);
    f = 0;
    while (f < 60*40) { hold(I.spring.x, 0.2, I.spring.z); g.tick(1/60,false); f++; }
    res.soakDone = g.taskDone('hot-spring');
    res.aurora = +I.aurora().toFixed(2);
    res.err = g.state.lastError || null;
    return res;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=y7ice2.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, out);
}
