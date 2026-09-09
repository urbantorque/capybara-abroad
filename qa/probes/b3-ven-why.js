async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch(e){} });
  await page.reload();
  await page.waitForTimeout(7000);
  const out = await page.evaluate(() => {
    const g = window.__capy, o = {};
    const settle = n => { for (let i=0;i<n;i++) g.tick(1/60,false); };
    g.biome.switchTo('venice');
    const sp = g.biome.spawnOf('venice'), b = g.capy.body, V = g.venice;
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    g.input.x = 0; g.input.z = 0;
    settle(120);
    o.start = { x:+g.capy.position.x.toFixed(3), y:+g.capy.position.y.toFixed(3), z:+g.capy.position.z.toFixed(3) };
    const trail = [];
    for (let k = 0; k < 12; k++) {
      const before = { x:b.position.x, y:b.position.y, z:b.position.z,
                       vx:b.velocity.x, vy:b.velocity.y, vz:b.velocity.z };
      settle(60);
      trail.push({ t: k+1,
        dz: +(b.position.z - before.z).toFixed(3),
        dy: +(b.position.y - before.y).toFixed(3),
        vz: +b.velocity.z.toFixed(4),
        vy: +b.velocity.y.toFixed(4),
        terr: +V.terrainHeight(b.position.x, b.position.z).toFixed(3),
        slope: +(V.slopeAt ? V.slopeAt(b.position.x, b.position.z) : -1).toFixed(4),
        grounded: !!g.capy.grounded,
        wet: +(g.capy.wet||0).toFixed(2),
        water: +V.waterHeightAt(b.position.x, b.position.z).toFixed(3),
        tide: +(V.tide ? V.tide() : -1).toFixed(3) });
    }
    o.trail = trail;
    // what is under the animal, per the analytic terrain vs where it rests?
    o.restY = +b.position.y.toFixed(3);
    o.terrAtRest = +V.terrainHeight(b.position.x, b.position.z).toFixed(3);
    o.gapToTerrain = +(b.position.y - o.terrAtRest).toFixed(3);
    // sample the analytic terrain across the drift line
    const line = [];
    for (let z = 10; z <= 22; z += 1) line.push([z, +V.terrainHeight(sp.x, z).toFixed(2)]);
    o.terrainAlongZ = line;
    o.lastError = g.state.lastError || null;
    return o;
  });
  await page.evaluate(async d => {
    await fetch('/shot?name=b3-ven-why.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(d)))) });
  }, out);
}
