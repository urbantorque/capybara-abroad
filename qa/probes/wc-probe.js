async page => {
  await page.reload(); await page.waitForTimeout(6500);
  await page.mouse.click(500, 400);
  await page.waitForTimeout(2500);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    g.biome.switchTo('palawan');
    for (let i=0;i<180;i++) g.tick(1/60,false);
    const b = g.capy.body;
    const put = (x,y,z) => { b.position.set(x,y,z); b.velocity.set(0,0,0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position); };
    const log = [];
    for (let i=0;i<60*20;i++) {
      const t = g.palawan.turtle();
      const tx = t.x, ty = t.y, tz = t.z;
      put(tx + 40, -3, tz + 40);
      g.tick(1/60,false);
      if (i % 120 === 0) {
        const p = g.capy.position;
        const t2 = g.palawan.turtle();
        log.push({ i, cap:[+p.x.toFixed(1),+p.y.toFixed(1),+p.z.toFixed(1)],
                   tur:[+t2.x.toFixed(1),+t2.y.toFixed(1),+t2.z.toFixed(1)],
                   d: +Math.hypot(p.x-t2.x, p.z-t2.z).toFixed(1),
                   done: g.taskDone('sea-turtle'), depth: +(g.capy.depth||0).toFixed(2) });
      }
      if (g.taskDone('sea-turtle')) { log.push({ DONE_AT: i }); break; }
    }
    return log;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=wc.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, out);
}
