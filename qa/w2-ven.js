async page => {
  await page.reload(); await page.waitForTimeout(6500);
  await page.mouse.click(500, 400);
  await page.waitForTimeout(2500);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const res = { err: null, steps: [] };
    g.state.lastError = null;
    g.biome.switchTo('venice');
    for (let i=0;i<120;i++) g.tick(1/60,false);
    const b = g.capy.body;
    const put = (x,y,z) => { b.position.set(x,y,z); b.velocity.set(0,0,0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position); };
    // ---- calli extent: enter MID maze, walk to both edges
    put(-54, 4, -26);
    for (let i=0;i<60;i++) g.tick(1/60,false);
    // drag east then west by teleporting along
    for (let x=-54; x<-32; x+=2) { put(x, g.capy.position.y+0.4, -26); for(let i=0;i<4;i++) g.tick(1/60,false); }
    for (let x=-32; x>-76; x-=2) { put(x, g.capy.position.y+0.4, -26); for(let i=0;i<4;i++) g.tick(1/60,false); }
    res.steps.push(['calli', g.taskDone('the-calli')]);
    // ---- crowd exists and moves
    res.crowd = { present: typeof g.venice === 'object' };
    // ---- run a full tide cycle standing in the square, check acqua-alta
    put(-4, 3, -34);
    let ticks = 0, tideMax = 0;
    while (ticks < 60*230 && !g.taskDone('acqua-alta')) {
      g.tick(1/60,false); ticks++;
      const t = g.venice.tide(); if (t > tideMax) tideMax = t;
      if (ticks % 30 === 0) put(-4, Math.max(g.capy.position.y, g.venice.tideY()+0.2), -34);
    }
    res.steps.push(['acqua-alta', g.taskDone('acqua-alta'), (ticks/60).toFixed(1), tideMax.toFixed(2)]);
    // ---- the well echo: wheek near the wellhead
    const c = g.venice.campo;
    put(c.x+1.0, 3.5, c.z);
    for (let i=0;i<40;i++) g.tick(1/60,false);
    try { g.events.emit('capy:wheek', { position: g.capy.position }); } catch(e){ res.err = String(e); }
    for (let i=0;i<120;i++) g.tick(1/60,false);
    res.steps.push(['wheek-ok', !g.state.lastError]);
    // ---- soak the rest of the tide with the crowd running
    for (let i=0;i<60*260;i++) g.tick(1/60,false);
    res.lastError = g.state.lastError || null;
    res.tris = g.renderer.info.render.triangles;
    res.pos = [+g.capy.position.x.toFixed(1), +g.capy.position.y.toFixed(1), +g.capy.position.z.toFixed(1)];
    return res;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=w2.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
