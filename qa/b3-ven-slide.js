async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch(e){} });
  await page.reload();
  await page.waitForTimeout(7000);
  const out = await page.evaluate(() => {
    const g = window.__capy, o = { issues: [] };
    const settle = n => { for (let i=0;i<n;i++) g.tick(1/60,false); };
    const drift = (name, x, z) => {
      g.biome.switchTo(name);
      const sp = g.biome.spawnOf(name), b = g.capy.body;
      const px = (x === undefined) ? sp.x : x, pz = (z === undefined) ? sp.z : z;
      b.position.set(px, sp.y, pz); b.velocity.set(0,0,0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      g.input.x = 0; g.input.z = 0; g.input.action = false; g.input.run = false;
      settle(120);
      const a = { x: g.capy.position.x, y: g.capy.position.y, z: g.capy.position.z };
      settle(60*60);
      const c = g.capy.position;
      return { dx: +(c.x-a.x).toFixed(2), dz: +(c.z-a.z).toFixed(2),
               dy: +(c.y-a.y).toFixed(2),
               moved: +Math.hypot(c.x-a.x, c.z-a.z).toFixed(2),
               endY: +c.y.toFixed(2), wet: +(g.capy.wet||0).toFixed(2) };
    };
    o.venice = drift('venice');
    o.veniceMolo = drift('venice', -4, 13);
    o.kyoto = drift('kyoto');
    o.sydney = drift('sydney');
    o.rio = drift('rio');
    // 1 m in 60 s of standing perfectly still is already too much.
    for (const k of ['venice','veniceMolo','kyoto','sydney','rio']) {
      if (o[k].moved > 1.0) o.issues.push(k + ' drifted ' + o[k].moved + ' m in 60 s of standing still');
    }
    o.lastError = g.state.lastError || null;
    return o;
  });
  await page.evaluate(async d => {
    await fetch('/shot?name=b3-ven-slide.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(d)))) });
  }, out);
}
