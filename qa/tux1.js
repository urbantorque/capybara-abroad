async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(1500);

  const out = await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('monaco');
    const sp = g.biome.spawnOf('monaco');
    const bd = g.capy.body;
    bd.position.set(sp.x, sp.y, sp.z);
    bd.velocity.set(0, 0, 0);
    bd.previousPosition.copy(bd.position);
    bd.interpolatedPosition.copy(bd.position);
    return { spawn: { x: sp.x, y: sp.y, z: sp.z } };
  });
  await page.waitForTimeout(2500);

  const r = await page.evaluate(() => {
    const g = window.__capy;
    const props = g.props || [];
    const tux = props.find(p => p.type === 'dinnerjacket' || (p.name && /jacket/.test(p.name)));
    const rows = props.map(p => ({
      type: p.type, biome: p.biome, removed: !!p.removed, held: !!p.held,
      grab: !!p.grabbable,
      x: +p.body.position.x.toFixed(2), y: +p.body.position.y.toFixed(2),
      z: +p.body.position.z.toFixed(2),
      sleep: p.body.sleepState,
    }));
    // every static body near the yacht, so we can see what boxes the deck has
    const w = g.world || (g.physics && g.physics.world);
    const near = [];
    const YX = 10, YZ = -59;
    if (w) {
      for (const b of w.bodies) {
        const d = Math.hypot(b.position.x - YX, b.position.z - YZ);
        if (d > 30) continue;
        const shp = b.shapes.map(s => {
          if (s.halfExtents) return 'box ' + [s.halfExtents.x, s.halfExtents.y, s.halfExtents.z].map(v => +v.toFixed(2)).join('/');
          return s.constructor && s.constructor.name;
        });
        near.push({ m: b.mass, x: +b.position.x.toFixed(2), y: +b.position.y.toFixed(2), z: +b.position.z.toFixed(2), shp });
      }
    }
    return {
      biome: g.biome.current,
      nProps: props.length,
      tux: tux ? { x: +tux.body.position.x.toFixed(2), y: +tux.body.position.y.toFixed(2), z: +tux.body.position.z.toFixed(2), grab: !!tux.grabbable, biome: tux.biome, sleep: tux.body.sleepState } : null,
      props: rows,
      nearYacht: near.length,
      near: near.slice(0, 80),
    };
  });

  await page.evaluate(async (o) => {
    await fetch('/shot?name=tux1.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, { ...out, ...r });
}
