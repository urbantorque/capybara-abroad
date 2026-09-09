async page => {
  await page.reload(); await page.waitForTimeout(5600);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2200);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const hold=(x,y,z)=>{const b=g.capy.body;b.position.set(x,y,z);b.velocity.set(0,0,0);
      b.previousPosition.copy(b.position);b.interpolatedPosition.copy(b.position);};
    g.biome.switchTo('drift');
    for (let i=0;i<300;i++) g.tick(1/60,false);
    const D = g.drift;
    const bad = [];
    // sweep a grid over the whole world and drop on anything terrainHeight
    // says is an island
    for (let x = -210; x <= 210; x += 6) {
      for (let z = -260; z <= 130; z += 6) {
        const ty = D.terrainHeight(x, z);
        if (!(ty > 1)) continue;
        hold(x, ty + 1.2, z);
        for (let i = 0; i < 40; i++) g.tick(1/60, false);
        const p = g.capy.position;
        if (Math.abs(p.y - (ty + 0.34)) > 0.6 || Math.hypot(p.x - x, p.z - z) > 2.5) {
          bad.push([x, z, +ty.toFixed(1), +p.y.toFixed(2),
                    +p.x.toFixed(1), +p.z.toFixed(1), !!g.capy.grounded]);
        }
      }
    }
    return { bad: bad.slice(0, 40), n: bad.length, err: g.state.lastError || null };
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=y7dri3.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, out);
}
