async page => {
  await page.reload(); await page.waitForTimeout(5600);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2200);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const res = {};
    const hold=(x,y,z)=>{const b=g.capy.body;b.position.set(x,y,z);b.velocity.set(0,0,0);
      b.previousPosition.copy(b.position);b.interpolatedPosition.copy(b.position);};
    g.biome.switchTo('drift');
    for (let i=0;i<300;i++) g.tick(1/60,false);
    const D = g.drift;
    const v = D.vane;
    const ty = D.terrainHeight(v.x + 1.4, v.z + 1.4);
    let f = 0;
    while (f < 60*70 && !g.taskDone('weathervane')) {
      hold(v.x + 1.4, ty + 0.34, v.z + 1.4); g.tick(1/60,false); f++;
    }
    res.vaneSeconds = +(f/60).toFixed(1);
    res.vaneDone = g.taskDone('weathervane');
    res.watch = +D.vaneWatch().toFixed(1);
    res.toTurn = +D.vaneToTurn().toFixed(1);
    res.err = g.state.lastError || null;
    return res;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=y7dri6.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, out);
}
