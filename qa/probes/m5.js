async page => {
  await page.evaluate(() => {
    const g = window.__capy;
    window.dispatchEvent(new KeyboardEvent('keydown', {code:'Space', key:' ', bubbles:true}));
  });
  await page.waitForTimeout(1200);
  const info = await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('manly');
    const out = {log: [], tasks: [], err: null};
    // put the animal out the back and let a wave take it
    g.capy.body.position.set(0, 1.0, -18);
    g.capy.body.velocity.set(0,0,0);
    let maxSp = 0, maxZ = -99, minZ = 99, swamFrames = 0, ridden = 0;
    const seen = new Set();
    g.events.on('task:complete', e => seen.add(e && e.id));
    for (let i = 0; i < 60*60; i++) {
      g.tick(1/60, false);
      const c = g.capy;
      const sp = Math.hypot(c.velocity.x, c.velocity.z);
      if (sp > maxSp) maxSp = sp;
      if (c.swimming) swamFrames++;
      if (g.manly.riding()) ridden++;
      if (c.body.position.z > maxZ) maxZ = c.body.position.z;
      if (c.body.position.z < minZ) minZ = c.body.position.z;
      if (i % 120 === 0) out.log.push([i/60, +c.body.position.z.toFixed(1), +c.body.position.y.toFixed(2),
                                       c.swimming?1:0, +sp.toFixed(1), +g.manly.rideDist().toFixed(1)]);
    }
    out.maxSp = +maxSp.toFixed(2); out.swamFrames = swamFrames; out.ridden = ridden;
    out.maxZ = +maxZ.toFixed(1); out.minZ = +minZ.toFixed(1);
    out.tasks = [...seen];
    out.err = g.state.lastError || null;
    out.setNear = +g.manly.setNear().toFixed(2);
    return out;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=result.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))});
  }, info);
}
