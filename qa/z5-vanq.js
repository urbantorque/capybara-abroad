async page => {
  await page.reload(); await page.waitForTimeout(5200);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2200);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const res = { stops: [] };
    if (!g.biome.isActive('sydney')) { g.biome.switchTo('sydney'); for (let i=0;i<90;i++) g.tick(1/60,false); }
    const b = g.capy.body;
    const hold = (x,z) => { b.position.set(x,1.0,z); b.velocity.set(0,0,0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position); };
    let maxQ = 0, cones = 0, coneEver = 0, minDwell = 99;
    for (let i = 0; i < 60 * 200; i++) {          // 200 s of game time
      const v = g.env.van();
      hold(v.x + 5, v.z + 5);                     // stand beside her wherever she is
      g.tick(1/60, false);
      let q = 0, c = 0;
      for (const r of g.npcs) {
        if (r.state === 'queue') q++;
        if (r.coneT >= 0) c++;
      }
      if (q > maxQ) maxQ = q;
      if (c > cones) cones = c;
      if (c > 0) coneEver++;
      if (i % 600 === 0) res.stops.push([+(i/60).toFixed(0), q, c, +g.env.vanDwellLeft().toFixed(1)]);
    }
    res.maxQueue = maxQ; res.maxCones = cones; res.coneFrames = coneEver;
    res.err = g.state.lastError || null;
    // and the flock
    let lm = null; g.scene.traverse(o => { if (o.name === 'envLorikeets') lm = o; });
    res.lori = !!lm;
    return res;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=z5.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
