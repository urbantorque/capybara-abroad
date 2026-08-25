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
    const clearIn = () => { IN.moveX=0; IN.moveZ=0; IN.jumpPressed=false; IN.jumpBuf=-1;
      IN.forward=false; IN.back=false; IN.left=false; IN.right=false; };

    // drive with a heading, hopping, for N frames; report the max y reached
    function drive(from, to, secs) {
      park(from.x, from.y, from.z);
      for (let i=0;i<40;i++) g.tick(1/60,false);
      let maxY = g.capy.position.y, land = g.capy.position.y;
      const N = Math.round(secs*60);
      for (let i=0;i<N;i++) {
        const p = g.capy.position;
        const dx = to.x-p.x, dz = to.z-p.z, L = Math.hypot(dx,dz)||1;
        // camera-relative -> world: write the world-space intent both ways
        IN.moveX = dx/L; IN.moveZ = dz/L;
        IN.worldMoveX = dx/L; IN.worldMoveZ = dz/L;
        if (i % 34 === 0) { IN.jumpPressed = true; IN.jumpBuf = 0; }
        g.tick(1/60,false);
        IN.jumpPressed = false;
        if (g.capy.position.y > maxY) maxY = g.capy.position.y;
        land = g.capy.position.y;
      }
      clearIn();
      return { maxY:+maxY.toFixed(2), endY:+land.toFixed(2),
               endX:+g.capy.position.x.toFixed(2), endZ:+g.capy.position.z.toFixed(2) };
    }

    // measured tops: sand 0, crate1 0.70, crate2 1.40, counter 2.11
    o.inputKeys = Object.keys(IN);
    // A: stand on crate1, hop straight up
    park(-5.9, 1.10, -8.0); for (let i=0;i<60;i++) g.tick(1/60,false);
    o.crate1RestY = +g.capy.position.y.toFixed(2);
    let y0 = g.capy.position.y, ap = y0;
    IN.jumpPressed = true; IN.jumpBuf = 0; g.tick(1/60,false); IN.jumpPressed=false;
    for (let i=0;i<90;i++){g.tick(1/60,false); if(g.capy.position.y>ap) ap=g.capy.position.y;}
    o.hopFromCrate1 = { rise:+(ap-y0).toFixed(2), settled:+g.capy.position.y.toFixed(2) };

    // B: stand on crate2, hop straight up
    park(-5.9, 1.80, -8.0); for (let i=0;i<60;i++) g.tick(1/60,false);
    o.crate2RestY = +g.capy.position.y.toFixed(2);
    y0 = g.capy.position.y; ap = y0;
    IN.jumpPressed = true; IN.jumpBuf = 0; g.tick(1/60,false); IN.jumpPressed=false;
    for (let i=0;i<90;i++){g.tick(1/60,false); if(g.capy.position.y>ap) ap=g.capy.position.y;}
    o.hopFromCrate2 = { rise:+(ap-y0).toFixed(2), settled:+g.capy.position.y.toFixed(2) };

    // C: full climb attempt from the sand
    o.tries.push(drive({x:-3.0,y:0.4,z:-8.0},{x:-8.0,z:-8.2}, 14));
    o.tries.push(drive({x:-5.9,y:1.1,z:-8.0},{x:-8.0,z:-8.2}, 10));
    o.err = g.state.lastError || null;
    return o;
  });
  await page.evaluate((o) => fetch('/shot?name=rio7.json', { method:'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out);
}
