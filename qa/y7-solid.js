async page => {
  await page.reload(); await page.waitForTimeout(5600);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2200);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const CANNON = g.CANNON;
    const res = {};
    const hold=(x,y,z)=>{const b=g.capy.body;b.position.set(x,y,z);b.velocity.set(0,0,0);
      b.previousPosition.copy(b.position);b.interpolatedPosition.copy(b.position);};
    g.biome.switchTo('drift');
    for (let i=0;i<300;i++) g.tick(1/60,false);
    // enumerate every static SHAPE with its world offset, then drop the animal
    // into the middle of each one and see whether it is pushed out
    const shapes = [];
    for (const b of g.world.bodies) {
      if (b.mass !== 0) continue;
      for (let si = 0; si < b.shapes.length; si++) {
        const sh = b.shapes[si];
        if (!sh.halfExtents) continue;
        const off = b.shapeOffsets[si] || {x:0,y:0,z:0};
        shapes.push([b.position.x+off.x, b.position.y+off.y, b.position.z+off.z,
                     sh.halfExtents.x, sh.halfExtents.y, sh.halfExtents.z]);
      }
    }
    res.staticShapes = shapes.length;
    // test only the small ones (walls, posts, furniture) — a deck collider is
    // six metres deep and dropping into the middle of it is not a fair test
    let tested = 0, through = 0;
    const bad = [];
    for (const s of shapes) {
      if (s[4] > 2.2) continue;             // skip the island decks
      if (Math.max(s[3], s[5]) > 4) continue; // skip the jetty slab
      tested++;
      hold(s[0], s[1] + s[4] + 0.5, s[2]);
      for (let i=0;i<50;i++) g.tick(1/60,false);
      const p = g.capy.position;
      // it should be resting ON it, not inside it
      if (p.y < s[1] + s[4] - 0.15) { through++; if (bad.length < 12) bad.push([+s[0].toFixed(1), +s[1].toFixed(1), +s[2].toFixed(1), +p.y.toFixed(2)]); }
    }
    res.tested = tested; res.through = through; res.bad = bad;
    res.err = g.state.lastError || null;
    return res;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=y7solid.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, out);
}
