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
    const tp = () => g.palawan.turtle ? g.palawan.turtle() : null;
    // Wait for her to be ON her way up (y climbing toward the surface), THEN
    // start the follow — so the six-second hold must survive the surfacing.
    let ticks = 0, armed = false, startTick = -1;
    let prev = -99;
    while (ticks < 60*400 && !g.taskDone('sea-turtle')) {
      const t = tp();
      if (!t) break;
      if (!armed) {
        // park well away so nothing counts yet
        put(t.x + 40, -3, t.z + 40);
        if (t.y > -1.0 && t.y > prev) { armed = true; startTick = ticks; }
        prev = t.y;
      } else {
        put(t.x, t.y - 0.7, t.z);
      }
      g.tick(1/60,false); ticks++;
      if (armed && ticks - startTick > 60*40) break;   // 40 s of following is plenty
    }
    return { done: g.taskDone('sea-turtle'), armedAt: startTick,
             follow: startTick >= 0 ? +((ticks - startTick)/60).toFixed(1) : -1,
             err: g.state.lastError || null };
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=wb.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, out);
}
