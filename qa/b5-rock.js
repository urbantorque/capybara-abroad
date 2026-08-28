async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2500);
  const out = { rows: [] };
  for (const nm of ['goreme', 'monaco', 'sahara']) {
    let row;
    try {
      row = await page.evaluate(async (nm) => {
        function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
        const g = window.__capy, CANNON = g.CANNON;
        if (g.biome.current !== nm) { g.biome.switchTo(nm); await sleep(1000); }
        for (let i = 0; i < 25; i++) g.tick(1 / 60, false);
        const r = { biome: nm, live: g.biome.current };
        if (g.biome.current !== nm) return r;
        const api = g[nm];
        const th = (x, z) => { const v = api.terrainHeight(x, z); return (typeof v === 'number' && v === v) ? v : NaN; };
        const ow = (typeof api.isOverWater === 'function') ? (x, z) => !!api.isOverWater(x, z) : () => false;

        // HOW MUCH STANDING ROOM IS THERE. A point counts as walkable if the
        // capybara's own collider — three spheres of r 0.34 with their centres
        // at ground + 0.34 — does not overlap a static box. That is the exact
        // question "did this block take away ground somebody was using", and it
        // is the one audit-solid.js cannot answer.
        const boxes = [];
        for (const b of g.world.bodies) {
          if (b.mass !== 0) continue;
          let skip = false;
          for (const s of b.shapes) {
            const t = s.constructor && s.constructor.name;
            if (t === 'Heightfield' || t === 'Plane') skip = true;
          }
          if (skip) continue;
          for (let si = 0; si < b.shapes.length; si++) {
            const s = b.shapes[si];
            if (!(s instanceof CANNON.Box)) continue;
            const off = b.shapeOffsets[si], q = b.shapeOrientations[si];
            const p = new CANNON.Vec3(off.x, off.y, off.z);
            b.quaternion.vmult(p, p); p.vadd(b.position, p);
            const qq = b.quaternion.mult(q);
            // yaw only; every box in these three chapters is upright
            const yaw = Math.atan2(2 * (qq.w * qq.y + qq.x * qq.z),
                                   1 - 2 * (qq.y * qq.y + qq.x * qq.x));
            boxes.push({ x: p.x, y: p.y, z: p.z,
                         hx: s.halfExtents.x, hy: s.halfExtents.y, hz: s.halfExtents.z,
                         c: Math.cos(-yaw), s: Math.sin(-yaw) });
          }
        }
        r.boxes = boxes.length;
        function blocked(x, y, z) {
          for (let i = 0; i < boxes.length; i++) {
            const b = boxes[i];
            const dx = x - b.x, dz = z - b.z, dy = y - b.y;
            if (dy < -b.hy - 0.34 || dy > b.hy + 0.34) continue;
            const lx = dx * b.c - dz * b.s, lz = dx * b.s + dz * b.c;
            if (lx > -b.hx - 0.34 && lx < b.hx + 0.34 &&
                lz > -b.hz - 0.34 && lz < b.hz + 0.34) return true;
          }
          return false;
        }
        // AND IS THE BLOCKED GROUND UNDER SOMETHING DRAWN? A collider grown to
        // fit a mesh takes away ground that was rock all along; one grown past
        // the mesh takes away ground somebody could stand on. The difference is
        // a downward ray at the blocked point: if there is drawn geometry more
        // than 0.5 m above the terrain there, the block is honest.
        const THREE = g.THREE;
        const dray = new THREE.Raycaster(); dray.far = 90;
        const dorg = new THREE.Vector3(), ddown = new THREE.Vector3(0, -1, 0);
        function roofAbove(x, h, z) {
          g.capy.group.visible = false;
          dorg.set(x, h + 60, z); dray.set(dorg, ddown);
          const hits = dray.intersectObject(g.scene, true);
          let top = -Infinity;
          for (let k = 0; k < hits.length; k++) {
            let o = hits[k].object, vis = true;
            while (o) { if (!o.visible) { vis = false; break; } o = o.parent; }
            if (vis) { top = hits[k].point.y; break; }
          }
          g.capy.group.visible = true;
          return top > h + 0.5;
        }
        const bb = g.biome.boundsOf(nm);
        const rects = bb ? (bb.rects || [bb]) : [];
        let land = 0, occ = 0, occRock = 0, occAir = 0;
        const N = 46;
        for (const q of rects) {
          for (let a = 0; a < N; a++) {
            for (let b2 = 0; b2 < N; b2++) {
              const x = q.x0 + (q.x1 - q.x0) * (a + 0.5) / N;
              const z = q.z0 + (q.z1 - q.z0) * (b2 + 0.5) / N;
              if (ow(x, z)) continue;
              const h = th(x, z);
              if (!(h === h)) continue;
              land++;
              if (blocked(x, h + 0.34, z)) { occ++; if (roofAbove(x, h, z)) occRock++; else occAir++; }
            }
          }
        }
        r.land = land; r.occupied = occ; r.occRock = occRock; r.occAir = occAir;
        r.occPct = land ? +(100 * occ / land).toFixed(2) : null;
        return r;
      }, nm);
    } catch (e) { row = { biome: nm, error: String(e).slice(0, 250) }; }
    out.rows.push(row);
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b5-rock.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);
}
