async page => {
  await page.reload(); await page.waitForTimeout(6500);
  await page.mouse.click(500, 400);
  await page.waitForTimeout(2500);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const res = { steps: [] };
    g.state.lastError = null;
    g.biome.switchTo('kowloon');
    for (let i=0;i<120;i++) g.tick(1/60,false);
    const b = g.capy.body;
    const put = (x,y,z) => { b.position.set(x,y,z); b.velocity.set(0,0,0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position); };
    // ---- symphony: arrive on the roof MID-show (was impossible)
    // wait until the show has been running for a few seconds, THEN go up
    let n = 0;
    while (!g.kowloon.showing() && n < 60*200) { g.tick(1/60,false); n++;
      if (n % 60 === 0) put(0, 1.4, 34); }
    for (let i=0;i<60*6;i++) { g.tick(1/60,false); if (i%40===0) put(0,1.4,34); }
    res.steps.push(['showing-before-climb', g.kowloon.showing(), g.taskDone('symphony')]);
    const r = g.kowloon.roof;
    for (let i=0;i<200;i++) { put(r.x, 30, r.z); g.tick(1/60,false); }
    res.steps.push(['symphony-midshow', g.taskDone('symphony')]);
    // ---- choi cheng: get on the lion, stay on through the rear
    let m = 0, got = false;
    while (m < 60*200 && !g.taskDone('choi-cheng')) {
      const L = g.kowloon.lion();
      put(L.x, L.y + 1.5, L.z);
      g.tick(1/60,false); m++;
    }
    res.steps.push(['choi-cheng', g.taskDone('choi-cheng'), (m/60).toFixed(1)]);
    // ---- climb ladder: no throw walking up the scaffold zone
    const s = g.kowloon.scaffold;
    for (let y=2; y<40; y+=0.5) { put(s.x, y, s.z); for(let i=0;i<3;i++) g.tick(1/60,false); }
    // ---- drip soak
    put(0, 1.4, 20);
    for (let i=0;i<60*180;i++) g.tick(1/60,false);
    res.lastError = g.state.lastError || null;
    res.pos = [+g.capy.position.x.toFixed(1),+g.capy.position.y.toFixed(1),+g.capy.position.z.toFixed(1)];
    return res;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=w4.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
