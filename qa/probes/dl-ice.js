async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5200);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2600);
  const out = await page.evaluate(() => {
    const g = window.__capy; g.biome.switchTo('iceland');
    for (let i=0;i<60;i++) g.tick(1/60,false);
    const a = g.iceland, b = g.capy.body, R = { s: [] };
    const s0 = a.spring;
    R.spring = { x: s0.x, z: s0.z, y: (s0.y===undefined?null:s0.y) };
    R.waterLevel = a.waterLevel;
    R.groundAt = +a.terrainHeight(s0.x, s0.z).toFixed(2);
    R.inZone = a.inZone('spring', s0.x, s0.z);
    R.wx = g.weather ? Object.keys(g.weather) : null;
    function put(x,z,y){ b.position.set(x,y,z); b.previousPosition.copy(b.position);
      b.interpolatedPosition.copy(b.position); b.velocity.set(0,0,0); b.wakeUp();
      g.capy.position.set(x,y,z); }
    put(s0.x, s0.z, a.terrainHeight(s0.x,s0.z)+0.45);
    for (let i=0;i<9000;i++){
      g.tick(1/60,false);
      const p=g.capy.position;
      if (Math.hypot(p.x-s0.x,p.z-s0.z)>1.0) put(s0.x,s0.z,a.terrainHeight(s0.x,s0.z)+0.45);
      if (i%1500===0) R.s.push({ f:i, soak:+a.soak().toFixed(2), y:+p.y.toFixed(2),
        sw:!!g.capy.swimming, wet:+g.capy.wet.toFixed(2),
        drz:+(g.weather.drizzle?g.weather.drizzle():-1).toFixed(2),
        wtn:+(g.weather.wetness?g.weather.wetness():-1).toFixed(2) });
    }
    return R;
  });
  await page.evaluate((o)=>fetch('/shot?name=dl-ice.json',{method:'POST',
    body:btoa(unescape(encodeURIComponent(JSON.stringify(o))))}), out);
}
