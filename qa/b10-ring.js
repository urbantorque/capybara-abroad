async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2500);

  // Block 8's corrected ring metric, generalised. Positions from meshes AND
  // instances, filtered by instance-scaled RADIUS and never by origin height
  // (trap 17); a cell is dressed only when it holds two things 3 m apart.
  async function run(page, tag) {
    return await page.evaluate(async (a) => {
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
      const g = window.__capy, THREE = g.THREE;
      if (g.biome.current !== a.tag) { g.biome.switchTo(a.tag); await sleep(1600); }
      for (let i = 0; i < 40; i++) g.tick(1 / 60, false);
      const r = { live: g.biome.current, want: a.tag };
      if (r.live !== a.tag) return r;

      const pts = [];
      const wp = new THREE.Vector3(), m4 = new THREE.Matrix4();
      g.scene.traverse((o) => {
        if (!o.isMesh && !o.isInstancedMesh) return;
        let p = o, vis = true;
        while (p) { if (!p.visible) { vis = false; break; } p = p.parent; }
        if (!vis) return;
        const gm = o.geometry; if (!gm) return;
        if (!gm.boundingSphere) { try { gm.computeBoundingSphere(); } catch (e) { return; } }
        const bs = gm.boundingSphere;
        o.updateWorldMatrix(true, false);
        if (o.isInstancedMesh) {
          if (bs && bs.radius > 12) return;
          for (let i = 0; i < o.count; i++) {
            o.getMatrixAt(i, m4);
            wp.setFromMatrixPosition(m4);
            const sc = Math.max(Math.abs(m4.elements[0]), Math.abs(m4.elements[5]), Math.abs(m4.elements[10]));
            if (bs && bs.radius * sc < 0.40) continue;
            o.localToWorld(wp);
            if (wp.x === wp.x) pts.push(wp.x, wp.y, wp.z);
          }
        } else {
          if (bs && (bs.radius > 60 || bs.radius < 0.40)) return;
          wp.setFromMatrixPosition(o.matrixWorld);
          if (wp.x === wp.x) pts.push(wp.x, wp.y, wp.z);
        }
      });
      r.points = pts.length / 3;

      const sp = g.biome.spawnOf(a.tag);
      r.spawn = [+sp.x.toFixed(1), +sp.z.toFixed(1)];
      const api = g[a.tag];
      r.ownBounds = (api && typeof api.bounds === 'function') ? api.bounds() : null;
      r.genBounds = g.biome.boundsOf(a.tag);
      const th = (x, z) => {
        if (!api || typeof api.terrainHeight !== 'function') return 0;
        const v = api.terrainHeight(x, z); return (v === v) ? v : 0;
      };
      const ow = (api && typeof api.isOverWater === 'function') ? (x, z) => !!api.isOverWater(x, z) : () => false;

      r.rings = [];
      for (const R of [20, 45, 70, 95]) {
        let cells = 0, filled = 0, water = 0;
        const empty = [];
        for (let ang = 0; ang < 6.283; ang += 20 / R) {
          const x = sp.x + Math.cos(ang) * R, z = sp.z + Math.sin(ang) * R;
          if (ow(x, z)) { water++; continue; }
          cells++;
          const y0 = th(x, z);
          const near = [];
          for (let i = 0; i < pts.length; i += 3) {
            const dx = pts[i] - x, dz = pts[i + 2] - z;
            if (dx * dx + dz * dz > 100) continue;
            if (pts[i + 1] < y0 - 4 || pts[i + 1] > y0 + 25) continue;
            near.push(pts[i], pts[i + 2]);
            if (near.length > 400) break;
          }
          let ok = false;
          for (let i = 0; i < near.length && !ok; i += 2) {
            for (let k = i + 2; k < near.length; k += 2) {
              const dx = near[i] - near[k], dz = near[i + 1] - near[k + 1];
              if (dx * dx + dz * dz >= 9) { ok = true; break; }
            }
          }
          if (ok) filled++;
          else empty.push([Math.round(x), Math.round(z), Math.round(ang * 57.3)]);
        }
        r.rings.push({ R: R, cells: cells, water: water, filled: filled,
                       pct: cells ? Math.round(100 * filled / cells) : 0, empty: empty });
      }

      let tris = 0;
      g.scene.traverse((o) => {
        if (!o.isMesh && !o.isInstancedMesh) return;
        let p = o, vis = true;
        while (p) { if (!p.visible) { vis = false; break; } p = p.parent; }
        if (!vis) return;
        const gm = o.geometry; if (!gm) return;
        const t = gm.index ? gm.index.count / 3 : (gm.attributes.position ? gm.attributes.position.count / 3 : 0);
        tris += t * (o.isInstancedMesh ? o.count : 1);
      });
      r.tris = Math.round(tris);
      r.bodies = g.world.bodies.length;
      return r;
    }, { tag: tag });
  }

  const res = {};
  for (const t of ['cave', 'drift', 'monaco']) res[t] = await run(page, t);

  await page.evaluate(async (o) => {
    await fetch('/shot?name=b10-ring.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, res);
}
