async page => {
  const out = await page.evaluate(() => {
    const g = window.__capy, o = { runs: [] };
    g.biome.switchTo('kowloon');
    const b = g.capy.body, k = g.kowloon, inp = g.input;
    const drive = (x,z,act) => { inp.camYaw=0; inp.x=x; inp.z=z; inp.action=!!act; inp.run=false; };
    o.capyShape = (function(){
      const s = b.shapes[0];
      return { type: s.constructor && s.constructor.name, radius: s.radius,
               he: s.halfExtents ? [s.halfExtents.x, s.halfExtents.y, s.halfExtents.z] : null,
               n: b.shapes.length,
               offs: (b.shapeOffsets||[]).map(v=>[v.x,v.y,v.z]) };
    })();
    for (const z0 of [0, 0.4, -3, 3, 6, -6, 8]) {
      b.position.set(-8.2, 0.4, z0); b.velocity.set(0,0,0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      let maxY = 0, t = 0;
      for (let i=0;i<60*22;i++) { drive(-1,0,true); g.tick(1/60,false); t+=1/60;
        if (b.position.y>maxY) maxY=b.position.y; }
      // what is it touching at the stall
      const hits = [];
      for (const c of g.world.contacts) {
        if (c.bi===b || c.bj===b) {
          const ot = c.bi===b?c.bj:c.bi;
          const s = ot.shapes[0];
          hits.push({ y:+ot.position.y.toFixed(2), x:+ot.position.x.toFixed(2), z:+ot.position.z.toFixed(2),
                      he: s.halfExtents?[s.halfExtents.x,s.halfExtents.y,s.halfExtents.z]:null });
        }
      }
      o.runs.push({ z0, maxY:+maxY.toFixed(2), end:[+b.position.x.toFixed(2),+b.position.y.toFixed(2),+b.position.z.toFixed(2)],
                    climbing: !!g.capy.climbing, hits: hits.slice(0,4) });
    }
    return o;
  });
  await page.evaluate(async (d) => {
    await fetch('/shot?name=b3hk3.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(d)))) });
  }, out);
}
