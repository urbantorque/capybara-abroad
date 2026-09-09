async page => {
  await page.reload(); await page.waitForTimeout(6500);
  await page.mouse.click(500, 400);
  await page.waitForTimeout(2500);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const P = window.__capyDbg || {};
    const res = { steps: [] };
    g.biome.switchTo('palawan');
    for (let i=0;i<180;i++) g.tick(1/60,false);
    const b = g.capy.body;
    const put = (x,y,z) => { b.position.set(x,y,z); b.velocity.set(0,0,0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position); };
    // --- find a sand point near the fire and a water point, by probing terrain
    const th = g.palawan.terrainHeight;
    const probe = [];
    for (let z=30; z<=60; z+=3) probe.push([z, +th(2,z).toFixed(2)]);
    res.profile = probe;
    // deepest water on that line
    let wz = 30, wy = 99;
    for (const [z,y] of probe) if (y < wy) { wy = y; wz = z; }
    res.water = [wz, wy];
    // get soaked
    put(2, wy + 0.3, wz);
    for (let i=0;i<60*8;i++) g.tick(1/60,false);
    res.steps.push(['wet-after-swim', +(g.capy.wet||0).toFixed(2), +g.capy.position.y.toFixed(2)]);
    // walk to the fire
    put(2, th(2,55)+0.6, 55);
    for (let i=0;i<60*3;i++) g.tick(1/60,false);
    res.steps.push(['fire', g.taskDone('beach-fire'), +(g.capy.wet||0).toFixed(2)]);
    return res;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=w9.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, out);
}
