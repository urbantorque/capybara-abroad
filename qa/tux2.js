async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(1500);

  await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('monaco');
    const sp = g.biome.spawnOf('monaco');
    const bd = g.capy.body;
    bd.position.set(sp.x, sp.y, sp.z);
    bd.velocity.set(0, 0, 0);
    bd.previousPosition.copy(bd.position);
    bd.interpolatedPosition.copy(bd.position);
  });
  await page.waitForTimeout(2500);

  const r = await page.evaluate(() => {
    const g = window.__capy;
    const w = g.world || (g.physics && g.physics.world);
    const YX = 10, YZ = -59;
    // Collect every static box SHAPE (world-space) within 32 m of the yacht,
    // walking each body's shapeOffsets so pooled multi-shape bodies are seen.
    const boxes = [];
    for (const b of w.bodies) {
      if (b.mass !== 0) continue;
      for (let i = 0; i < b.shapes.length; i++) {
        const s = b.shapes[i];
        if (!s.halfExtents) continue;
        const o = b.shapeOffsets[i] || { x: 0, y: 0, z: 0 };
        const x = b.position.x + o.x, y = b.position.y + o.y, z = b.position.z + o.z;
        if (Math.hypot(x - YX, z - YZ) > 32) continue;
        boxes.push({
          x: +x.toFixed(2), y: +y.toFixed(2), z: +z.toFixed(2),
          hx: +s.halfExtents.x.toFixed(2), hy: +s.halfExtents.y.toFixed(2),
          hz: +s.halfExtents.z.toFixed(2),
          q: (b.quaternion.x || b.quaternion.y || b.quaternion.z) ? 1 : 0,
        });
      }
    }
    boxes.sort((a, b2) => a.y - b2.y);

    // A vertical probe: for a grid of (x,z) around the yacht, what are the
    // top surfaces of boxes underneath, i.e. what can you stand on and what is
    // the headroom above each.
    function columnAt(px, pz) {
      const hits = [];
      for (const b of boxes) {
        if (b.q) continue;
        if (Math.abs(px - b.x) > b.hx || Math.abs(pz - b.z) > b.hz) continue;
        hits.push([+(b.y - b.hy).toFixed(2), +(b.y + b.hy).toFixed(2)]);
      }
      hits.sort((a, b2) => a[0] - b2[0]);
      return hits;
    }
    const cols = {};
    // the aft companionway line (local x +2.2 => world 12.2, and -2.2 => 7.8)
    for (const [nm, px, pz0, pz1] of [
      ['stair1 x=12.2', 12.2, -65, -60],
      ['stair2 x=7.8', 7.8, -65, -60],
      ['sundeck x=10', 10, -68, -58],
    ]) {
      const arr = [];
      for (let z = pz0; z <= pz1; z += 0.5) arr.push([+z.toFixed(1), columnAt(px, z)]);
      cols[nm] = arr;
    }
    return { nBoxes: boxes.length, boxes, cols };
  });

  await page.evaluate(async (o) => {
    await fetch('/shot?name=tux2.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, r);
}
