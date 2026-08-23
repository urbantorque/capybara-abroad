async page => {
  await page.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown', {code:'Space', key:' ', bubbles:true})); });
  await page.waitForTimeout(1200);
  const info = await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('manly');
    const out = {rides: [], tasks: [], err: null, best: 0, bestSp: 0};
    const seen = new Set();
    g.events.on('task:complete', e => seen.add(e && e.id));
    let last = 0, sp = 0;
    for (let i = 0; i < 60*260; i++) {
      // keep putting it back out the back so it can catch several waves
      const p = g.capy.body.position;
      if (p.z > 26 || p.z < -34) { p.set(0, 1.0, -26); g.capy.body.velocity.set(0,0,0); }
      g.tick(1/60, false);
      const d = g.manly.rideDist();
      const s = Math.hypot(g.capy.velocity.x, g.capy.velocity.z);
      if (s > sp) sp = s;
      if (d > last) last = d;
      if (d === 0 && last > 3) { out.rides.push(+last.toFixed(1)); if (last > out.best) out.best = +last.toFixed(1); last = 0; }
      if (s > out.bestSp) out.bestSp = +s.toFixed(1);
    }
    out.tasks = [...seen];
    out.err = g.state.lastError || null;
    return out;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=result.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))});
  }, info);
}
