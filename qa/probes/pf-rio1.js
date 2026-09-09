async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch(e){} });
  await page.reload();
  await page.waitForTimeout(6000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2500);
  const out = await page.evaluate(() => {
    const g = window.__capy;
    const o = { started: !!(g && g.state && g.state.started) };
    if (!g) return o;
    g.biome.switchTo('rio');
    const sp = g.biome.spawnOf('rio'), b = g.capy.body;
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    for (let i=0;i<180;i++) g.tick(1/60,false);
    const r = g.rio;
    o.spawn = { x: sp.x, y: sp.y, z: sp.z };
    o.api = Object.keys(r).sort();
    o.kiosk = r.kiosk;
    o.terrKiosk = r.terrainHeight(r.kiosk.x, r.kiosk.z);
    // what solid boxes are near the kiosk
    o.blocked = [];
    for (let dx=-6; dx<=6; dx+=1) for (let dz=-6; dz<=6; dz+=1) {
      const x = r.kiosk.x+dx, z = r.kiosk.z+dz;
      if (r.navBlocked(x,z,0.5)) o.blocked.push([+dx.toFixed(0), +dz.toFixed(0)]);
    }
    // cannon bodies near the kiosk
    o.bodies = [];
    for (const bb of g.world.bodies) {
      const d = Math.hypot(bb.position.x - r.kiosk.x, bb.position.z - r.kiosk.z);
      if (d < 8) o.bodies.push({ d:+d.toFixed(2), y:+bb.position.y.toFixed(2), m:bb.mass,
        sh: bb.shapes.map((s,i)=>({t:s.type, he: s.halfExtents ? [s.halfExtents.x,s.halfExtents.y,s.halfExtents.z].map(v=>+v.toFixed(2)) : null,
          off: bb.shapeOffsets[i] ? [bb.shapeOffsets[i].x,bb.shapeOffsets[i].y,bb.shapeOffsets[i].z].map(v=>+v.toFixed(2)) : null })) });
    }
    o.bodies.sort((a,c)=>a.d-c.d);
    o.zones = {};
    for (const n of ['avenue','beach','calcadao','arpoador','santateresa','column'])
      o.zones[n] = r.inZone(n, 0, 0);
    return o;
  });
  await page.evaluate((s) => fetch('/shot?name=rio1.json', { method:'POST', body: s }),
    await page.evaluate(() => ''));
  await page.evaluate((o) => fetch('/shot?name=rio1.json', { method:'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out);
}
