async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch(e){} });
  await page.reload();
  await page.waitForTimeout(6000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(3000);
  const out = await page.evaluate(() => {
    const g = window.__capy; const o = { tries: [] };
    const park = (x,y,z) => { const b=g.capy.body; b.position.set(x,y,z); b.velocity.set(0,0,0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position); };
    g.biome.switchTo('rio'); park(0,1.4,0);
    for (let i=0;i<150;i++) g.tick(1/60,false);
    const IN = g.input;
    const aim = (wx, wz) => { const L = Math.hypot(wx,wz)||1; wx/=L; wz/=L;
      const cy = Math.cos(IN.camYaw), sy = Math.sin(IN.camYaw);
      IN.x = wx*cy - wz*sy; IN.z = wx*sy + wz*cy; };

    function climb(from, waypoints, secs, hopEvery) {
      park(from.x, from.y, from.z);
      for (let i=0;i<40;i++) g.tick(1/60,false);
      let maxY = g.capy.position.y, wi = 0;
      const N = Math.round(secs*60);
      for (let i=0;i<N;i++) {
        const p = g.capy.position; const t = waypoints[Math.min(wi, waypoints.length-1)];
        if (Math.hypot(t.x-p.x, t.z-p.z) < 1.0 && wi < waypoints.length-1) wi++;
        aim(t.x-p.x, t.z-p.z);
        IN.run = true;
        if (i % hopEvery === 0) { IN.jumpPressed = true; IN.jumpBuf = 0; }
        g.tick(1/60,false);
        IN.jumpPressed = false;
        if (g.capy.position.y > maxY) maxY = g.capy.position.y;
      }
      IN.x=0; IN.z=0; IN.run=false; IN.jumpPressed=false; IN.jumpBuf=-1;
      for (let i=0;i<60;i++) g.tick(1/60,false);
      return { maxY:+maxY.toFixed(2), restY:+g.capy.position.y.toFixed(2),
               x:+g.capy.position.x.toFixed(2), z:+g.capy.position.z.toFixed(2), wi };
    }
    // crates at (-5.9,-8.0); counter at (-8.0,-8.2). tops: 0.70 / 1.40 / 2.11
    for (const hop of [22, 30, 40]) {
      o.tries.push(Object.assign({ hop },
        climb({x:-2.5,y:0.4,z:-8.0}, [{x:-5.9,z:-8.0},{x:-8.0,z:-8.2}], 18, hop)));
    }
    // and from already on the top crate, running at the counter
    o.fromCrate2 = climb({x:-5.9,y:1.9,z:-8.0}, [{x:-8.0,z:-8.2}], 12, 24);
    // reference: what does resting ON the counter read as?
    park(-8.0, 3.2, -8.2); for (let i=0;i<120;i++) g.tick(1/60,false);
    o.droppedOnCounter = +g.capy.position.y.toFixed(2);
    o.err = g.state.lastError || null;
    return o;
  });
  await page.evaluate((o) => fetch('/shot?name=rio8.json', { method:'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out);
}
