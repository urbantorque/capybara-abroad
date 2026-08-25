async page => {
  const out = await page.evaluate(() => {
    const g = window.__capy, o = {};
    g.biome.switchTo('kowloon');
    const b = g.capy.body, k = g.kowloon;
    const sp = g.biome.spawnOf('kowloon');
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    for (let i=0;i<90;i++) g.tick(1/60,false);
    const inp = g.input;
    const drive = (x,z,act,run) => { inp.camYaw=0; inp.x=x; inp.z=z; inp.action=!!act; inp.run=!!run; };
    // ---- leg 1: run from spawn to the foot of the scaffold
    const scaf = k.scaffold;
    let t = 0, legRun = -1;
    for (let i=0;i<60*40;i++) {
      const p = b.position;
      let dx = scaf.x - p.x, dz = scaf.z - p.z;
      const d = Math.hypot(dx,dz);
      if (d < 1.2) { legRun = t; break; }
      drive(dx/d, dz/d, false, true);
      g.tick(1/60,false); t += 1/60;
    }
    o.runToScaffold = +legRun.toFixed(2);
    o.atScaf = { x:+b.position.x.toFixed(2), y:+b.position.y.toFixed(2), z:+b.position.z.toFixed(2) };
    o.holdAtFoot = k.climbHold(b.position.x, b.position.y, b.position.z);
    // ---- leg 2: hold E into the -x face and climb
    let t2 = 0, to26 = -1, toRoof = -1, maxY = b.position.y, clung = 0;
    const trace = [];
    for (let i=0;i<60*40;i++) {
      drive(-1, 0, true, false);
      g.tick(1/60,false); t2 += 1/60;
      const y = b.position.y;
      if (g.capy.climbing) clung += 1/60;
      if (y > maxY) maxY = y;
      if (to26 < 0 && y > 26) to26 = t2;
      if (toRoof < 0 && y > 34.0) toRoof = t2;
      if (i % 60 === 0) trace.push([+t2.toFixed(1), +y.toFixed(2), g.capy.climbing?1:0, +(g.capy.stamina||0).toFixed(2)]);
      if (toRoof > 0) break;
    }
    o.climbTo26 = +to26.toFixed(2); o.climbToRoof = +toRoof.toFixed(2);
    o.maxY = +maxY.toFixed(2); o.clungFor = +clung.toFixed(2); o.trace = trace;
    o.endPos = { x:+b.position.x.toFixed(2), y:+b.position.y.toFixed(2), z:+b.position.z.toFixed(2) };
    o.stamEnd = g.capy.stamina;
    // ---- after topping out: let go and see where it settles
    drive(0,0,false,false);
    for (let i=0;i<60*4;i++) g.tick(1/60,false);
    o.settled = { x:+b.position.x.toFixed(2), y:+b.position.y.toFixed(2), z:+b.position.z.toFixed(2) };
    o.pitchAtSettled = k.surfacePitch(b.position.x, b.position.z, b.position.y);
    o.totalClimbCost = +(legRun + (to26>0?to26:99)).toFixed(2);
    return o;
  });
  await page.evaluate(async (d) => {
    await fetch('/shot?name=b3hk2.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(d)))) });
  }, out);
}
