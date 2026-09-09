async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
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
    // THE BEAT THE CHAPTER DESCRIBES: swim with her, and when she goes up for
    // air, go up WITH her — i.e. break the surface, exactly as a player out of
    // breath at the same moment would.
    let k=0, armed=false, start=-1, prevY=-99, surfaced=0, minDepth=9;
    while (k < 60*430) {
      const t = g.palawan.turtle();
      if (!armed) {
        put(t.x + 45, -3, t.z + 45);
        // arm four seconds BEFORE she starts up, so the hold has to cross it
        if (t.y > -1.2 && t.y > prevY) { armed = true; start = k; }
        prevY = t.y;
      } else {
        // follow her, matching her depth — so when she surfaces, so do we
        const y = Math.min(t.y + 0.05, -0.05);
        put(t.x + 1.2, y, t.z);
      }
      g.tick(1/60,false); k++;
      if (armed) {
        const d = g.capy.depth || 0;
        if (d < minDepth) minDepth = d;
        if (d < 0.65) surfaced++;
      }
      if (armed && g.taskDone('sea-turtle')) break;
      if (armed && k - start > 60*50) break;
    }
    return { done: g.taskDone('sea-turtle'),
             followed: start>=0 ? +((k-start)/60).toFixed(1) : -1,
             framesAtSurface: surfaced, minDepth: +minDepth.toFixed(2),
             err: g.state.lastError || null };
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=we.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, out);
}
