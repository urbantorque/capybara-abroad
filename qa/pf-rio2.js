async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch(e){} });
  await page.reload();
  await page.waitForTimeout(6000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2500);
  const out = await page.evaluate(() => {
    const g = window.__capy; const o = {};
    const park = (x,y,z) => { const b=g.capy.body; b.position.set(x,y,z); b.velocity.set(0,0,0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position); };
    g.biome.switchTo('rio');
    park(0,1.4,0); for (let i=0;i<120;i++) g.tick(1/60,false);
    const r = g.rio;
    const sc = () => g.state.score;

    // ---- A: kiosk from the SAND, no climb at all -------------------------
    park(r.kiosk.x, r.terrainHeight(r.kiosk.x, r.kiosk.z)+0.4, r.kiosk.z);
    for (let i=0;i<30;i++) g.tick(1/60,false);
    o.standY = +g.capy.position.y.toFixed(2);
    const s0 = sc();
    g.input.actionPressed = true; g.tick(1/60,false);
    g.input.actionPressed = false;
    for (let i=0;i<20;i++) g.tick(1/60,false);
    o.kioskFromSand = sc() - s0;

    // ---- B: how far away does it still fire (fresh page needed) ----------
    // measured instead from the code radius; here record where the beacon points
    o.beacon = { x: r.kiosk.x, z: r.kiosk.z };

    // ---- C: bonde. where are the two trams, and the arch deck height -----
    o.bonde = r.bonde().toArray().map(v=>+v.toFixed(2));
    o.lapa = r.lapa;
    return o;
  });
  await page.evaluate((o) => fetch('/shot?name=rio2.json', { method:'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out);
}
