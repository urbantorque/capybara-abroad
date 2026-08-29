async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5500);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2000);

  const BIOMES = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland',
                  'sahara', 'drift', 'venice', 'kowloon', 'palawan', 'goreme',
                  'manly', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi'];

  const all = {};
  for (const b of BIOMES) {
    const r = await page.evaluate(async (name) => {
      const g = window.__capy;
      g.biome.switchTo(name);
      await new Promise(res => setTimeout(res, 900));
      const w = g.world || (g.physics && g.physics.world);

      // Every axis-aligned static box in the live world, in world space.
      const B = [];
      for (const bd of w.bodies) {
        if (bd.mass !== 0) continue;
        const q = bd.quaternion;
        const turned = Math.abs(q.x) > 1e-4 || Math.abs(q.z) > 1e-4;
        for (let i = 0; i < bd.shapes.length; i++) {
          const s = bd.shapes[i];
          if (!s.halfExtents) continue;
          const o = bd.shapeOffsets[i] || { x: 0, y: 0, z: 0 };
          // shape offsets are in body space; only trust untilted bodies
          if (turned || Math.abs(q.y) > 1e-4) continue;
          const x = bd.position.x + o.x, y = bd.position.y + o.y, z = bd.position.z + o.z;
          B.push({ x0: x - s.halfExtents.x, x1: x + s.halfExtents.x,
                   y0: y - s.halfExtents.y, y1: y + s.halfExtents.y,
                   z0: z - s.halfExtents.z, z1: z + s.halfExtents.z });
        }
      }

      // A PLATFORM WHOSE TOP FACE IS INSIDE ANOTHER BOX IS A FLOOR YOU CANNOT
      // STAND ON. Report the ones that are wide enough to have been meant as a
      // floor (>= 2 m each way), buried by more than 5 cm, and covered over
      // most of their area.
      const out = [];
      for (let i = 0; i < B.length && out.length < 40; i++) {
        const a = B[i];
        const aw = a.x1 - a.x0, ad = a.z1 - a.z0;
        if (aw < 2 || ad < 2) continue;
        if (a.y1 - a.y0 > 2.5) continue;               // a slab, not a block
        let covered = 0, by = null;
        for (let j = 0; j < B.length; j++) {
          if (j === i) continue;
          const c = B[j];
          if (!(c.y0 < a.y1 - 0.05 && c.y1 > a.y1 + 0.05)) continue;  // straddles a's top face
          const ox = Math.max(0, Math.min(a.x1, c.x1) - Math.max(a.x0, c.x0));
          const oz = Math.max(0, Math.min(a.z1, c.z1) - Math.max(a.z0, c.z0));
          const f = (ox * oz) / (aw * ad);
          if (f > covered) { covered = f; by = c; }
        }
        if (covered > 0.75) {
          out.push({
            slab: [+a.x0.toFixed(1), +a.x1.toFixed(1), +a.y1.toFixed(2), +a.z0.toFixed(1), +a.z1.toFixed(1)],
            buriedBy: +(by.y1 - a.y1).toFixed(2),
            cover: +covered.toFixed(2),
          });
        }
      }
      return { biome: g.biome.current, boxes: B.length, buried: out };
    }, b);
    all[b] = r;
  }

  await page.evaluate(async (o) => {
    await fetch('/shot?name=buried.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, all);
}
