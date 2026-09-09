async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch(e){} });
  await page.reload();
  await page.waitForTimeout(7000);
  const out = await page.evaluate(() => {
    const g = window.__capy, o = {};
    g.biome.switchTo('kowloon');
    const b = g.capy.body, k = g.kowloon, inp = g.input;
    const drive = (x,z,act) => { inp.camYaw=0; inp.x=x; inp.z=z; inp.action=!!act; inp.run=false; };
    b.position.set(-8.2, 0.4, 0); b.velocity.set(0,0,0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    const done = () => ({ sym: g.taskDone("symphony"), climb: g.taskDone("bamboo-climb") });
    o.tasksBefore = done();
    let ticks = 0, sawShow = false, tickedAt = -1;
    for (let i=0;i<60*175;i++) {
      drive(-1,0,true); g.tick(1/60,false); ticks++;
      if (k.showing()) {
        sawShow = true;
        if (tickedAt < 0) {
          const d = done();
          if (d && d.sym) tickedAt = +(ticks/60).toFixed(2);
        }
      }
      if (sawShow && !k.showing()) break;
    }
    o.simSeconds = +(ticks/60).toFixed(1);
    o.y = +b.position.y.toFixed(2);
    o.climbing = !!g.capy.climbing;
    o.symphonyDone = tickedAt;
    o.tasksAfter = done();
    o.seenShow = k.seenShow();
    o.record = (g.record&&0)||null;
    return o;
  });
  await page.evaluate(async (d) => {
    await fetch('/shot?name=b3hk4.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(d)))) });
  }, out);
}
