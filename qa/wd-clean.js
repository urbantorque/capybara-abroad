async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload(); await page.waitForTimeout(6500);
  await page.mouse.click(500, 400);
  await page.waitForTimeout(2500);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const res = { pre: {}, steps: [] };
    const b = g.capy.body;
    const put = (x,y,z) => { b.position.set(x,y,z); b.velocity.set(0,0,0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position); };
    for (const id of ['the-calli','acqua-alta','symphony','choi-cheng','sea-turtle','bait-ball'])
      res.pre[id] = g.taskDone(id);

    // ================= VENICE: calli from a MID-MAZE entry ==============
    g.biome.switchTo('venice');
    for (let i=0;i<120;i++) g.tick(1/60,false);
    put(-54, 4, -26);
    for (let i=0;i<60;i++) g.tick(1/60,false);
    for (let x=-54; x<-32; x+=1.5) { put(x, g.capy.position.y+0.3, -26); for(let i=0;i<4;i++) g.tick(1/60,false); }
    for (let x=-32; x>-76; x-=1.5) { put(x, g.capy.position.y+0.3, -26); for(let i=0;i<4;i++) g.tick(1/60,false); }
    res.steps.push(['ven calli (mid-maze entry)', g.taskDone('the-calli')]);

    // ================= VENICE: acqua alta, ARRIVING LATE ================
    // Stand well away until the water is over the square, THEN walk in.
    let n=0, crossed=false;
    while (n < 60*260 && !crossed) {
      put(-60, 4, -26);                       // in the calli, dry, far from the square
      g.tick(1/60,false); n++;
      if (g.venice.flooded()) crossed = true;
    }
    // eight seconds later, walk into the square
    for (let i=0;i<60*8;i++) { put(-60, 4, -26); g.tick(1/60,false); }
    res.steps.push(['ven flood crossed, still open', crossed, g.taskDone('acqua-alta')]);
    for (let i=0;i<60*6;i++) { put(-4, Math.max(1.6, g.venice.tideY()+0.3), -34); g.tick(1/60,false); }
    res.steps.push(['ven acqua-alta (arrived 8s late)', g.taskDone('acqua-alta'), +g.venice.tide().toFixed(2)]);

    // ================= KOWLOON: symphony MID-show =======================
    g.biome.switchTo('kowloon');
    for (let i=0;i<120;i++) g.tick(1/60,false);
    let m=0;
    while (!g.kowloon.showing() && m < 60*220) { put(0,1.4,34); g.tick(1/60,false); m++; }
    for (let i=0;i<60*7;i++) { put(0,1.4,34); g.tick(1/60,false); }
    res.steps.push(['hk show running, still open', g.kowloon.showing(), g.taskDone('symphony')]);
    const rf = g.kowloon.roof;
    for (let i=0;i<180;i++) { put(rf.x, 30, rf.z); g.tick(1/60,false); }
    res.steps.push(['hk symphony (arrived 7s late)', g.taskDone('symphony')]);

    // ================= PALAWAN: turtle THROUGH a surfacing ==============
    g.biome.switchTo('palawan');
    for (let i=0;i<180;i++) g.tick(1/60,false);
    let k=0, armed=false, start=-1, prevY=-99, sawUp=false;
    while (k < 60*420) {
      const t = g.palawan.turtle();
      if (!armed) {
        put(t.x + 45, -3, t.z + 45);
        if (t.y > -1.0 && t.y > prevY) { armed = true; start = k; }
        prevY = t.y;
      } else {
        put(t.x, t.y - 0.7, t.z);
        if (g.palawan.turtle().y > -0.6) sawUp = true;
      }
      g.tick(1/60,false); k++;
      if (armed && g.taskDone('sea-turtle')) break;
      if (armed && k - start > 60*45) break;
    }
    res.steps.push(['pal turtle (follow begun mid-ascent)', g.taskDone('sea-turtle'),
                    sawUp, start >= 0 ? +((k-start)/60).toFixed(1) : -1]);
    res.lastError = g.state.lastError || null;
    return res;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=wd.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
