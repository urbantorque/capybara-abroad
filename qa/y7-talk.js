async page => {
  await page.reload(); await page.waitForTimeout(5600);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2200);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const res = {};
    const hold=(x,y,z)=>{const b=g.capy.body;b.position.set(x,y,z);b.velocity.set(0,0,0);
      b.previousPosition.copy(b.position);b.interpolatedPosition.copy(b.position);};
    const heard = [];
    const grab = () => {
      const locs = []; for (const b of g.world.bodies) if (b.userData && b.userData.local) locs.push(b.userData.local);
      return locs;
    };
    // ---- ICELAND: rob the stand in front of the man, listen for his line ----
    g.biome.switchTo('iceland');
    for (let i=0;i<300;i++) g.tick(1/60,false);
    const I = g.iceland;
    hold(I.pylsa.x, 1.0, I.pylsa.z + 2.4);
    for (let i=0;i<40;i++){ g.input.actionPressed = true; g.tick(1/60,false); }
    for (let i=0;i<90;i++) g.tick(1/60,false);
    res.icePylsa = g.taskDone('pylsa');
    res.iceSaid = grab().filter(L=>L.biome==='iceland').map(L=>L.last).filter(Boolean);
    // ---- SAHARA: sit in the basket, listen ----
    g.biome.switchTo('sahara');
    for (let i=0;i<300;i++) g.tick(1/60,false);
    const S = g.sahara;
    hold(S.basket.x, 1.5, S.basket.z);
    for (let i=0;i<200;i++) g.tick(1/60,false);
    res.sahSnake = g.taskDone('snake-basket');
    res.sahSaid = grab().filter(L=>L.biome==='sahara').map(L=>L.last).filter(Boolean);
    // ---- DRIFT: wheek at the orchard keeper ----
    g.biome.switchTo('drift');
    for (let i=0;i<300;i++) g.tick(1/60,false);
    const D = g.drift;
    hold(D.orchard.x + 2, D.terrainHeight(D.orchard.x+2, D.orchard.z+2) + 0.4, D.orchard.z + 2);
    for (let i=0;i<300;i++){ if (i%80===0) g.input.honkPressed = true; g.tick(1/60,false); }
    res.driFlies = D.lampflies();
    res.driSaid = grab().filter(L=>L.biome==='drift').map(L=>L.last).filter(Boolean);
    res.err = g.state.lastError || null;
    return res;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=y7talk.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
