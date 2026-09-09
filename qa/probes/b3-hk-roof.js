async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch(e){} });
  await page.reload();
  await page.waitForTimeout(7000);
  const out = await page.evaluate(() => {
    const g = window.__capy, o = { issues: [] };
    g.biome.switchTo('kowloon');
    const b = g.capy.body, k = g.kowloon, inp = g.input;
    const drive = (x,z,act) => { inp.camYaw=0; inp.x=x; inp.z=z; inp.action=!!act; inp.run=false; };
    b.position.set(-8.2, 0.4, 0); b.velocity.set(0,0,0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    let peak = -99;
    for (let i=0;i<60*90;i++) { drive(-1,0,true); g.tick(1/60,false); if (b.position.y > peak) peak = b.position.y; }
    o.climbPeak = +peak.toFixed(2);
    // LET GO, and walk inland onto the deck. Closed loop on the roof mark:
    // input is camera-relative and camYaw drifts, so a held key is not a
    // direction.
    for (let i=0;i<60*8;i++) {
      const p = g.capy.position, r = k.roof
      const dx = r.x - p.x, dz = r.z - p.z, m = Math.hypot(dx, dz) || 1
      const cy = g.input.camYaw || 0
      const sx = Math.cos(cy) * (dx/m) - Math.sin(cy) * (dz/m)
      const sz = Math.sin(cy) * (dx/m) + Math.cos(cy) * (dz/m)
      g.input.camYaw = cy; g.input.x = sx; g.input.z = sz; g.input.action = false; g.input.run = false
      g.tick(1/60,false)
    }
    o.afterLetGoY = +b.position.y.toFixed(2);
    o.afterLetGoX = +b.position.x.toFixed(2);
    o.climbing = !!g.capy.climbing;
    // and stand still on it for four seconds
    for (let i=0;i<60*4;i++) { drive(0,0,false); g.tick(1/60,false); }
    o.restY = +b.position.y.toFixed(2);
    o.restX = +b.position.x.toFixed(2);
    o.surfacePitchOnRoof = k.surfacePitch ? k.surfacePitch(b.position.x, b.position.z, b.position.y) : null;
    o.signZone = k.inZone('sign', 3.6, -7);
    o.roofMark = k.roof;
    if (peak < 34.0) o.issues.push('the climb tops out at ' + o.climbPeak + ', below the 34.2 deck');
    if (o.restY < 33.5) o.issues.push('let go on the roof and the animal ended at y ' + o.restY);
    if (!o.roofMark || typeof o.roofMark.y !== 'number') o.issues.push('the roof mark has no y');
    if (!o.signZone) o.issues.push('inZone(sign) is false at the sign');
    o.lastError = g.state.lastError || null;
    return o;
  });
  await page.evaluate(async (d) => {
    await fetch('/shot?name=b3-hk-roof.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(d)))) });
  }, out);
}
