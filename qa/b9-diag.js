async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2500);

  const res = {};
  for (const tag of ['pantanal', 'hanoi']) {
    res[tag] = await page.evaluate(async (q) => {
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
      const g = window.__capy, THREE = g.THREE;
      if (g.biome.current !== q.tag) { g.biome.switchTo(q.tag); await sleep(1500); }
      for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
      const r = { live: g.biome.current };
      if (r.live !== q.tag) return r;

      const api = g[q.tag];
      r.ownBounds = (api && typeof api.bounds === 'function') ? api.bounds() : null;
      r.genBounds = g.biome.boundsOf(q.tag);

      // where the game's own camera sits at spawn, and what is between it and
      // the animal.
      const p = g.capy.renderPosition;
      r.capy = [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)];
      r.body = [+g.capy.body.position.x.toFixed(2), +g.capy.body.position.y.toFixed(2), +g.capy.body.position.z.toFixed(2)];
      const c = g.camera.position;
      r.cam = [+c.x.toFixed(2), +c.y.toFixed(2), +c.z.toFixed(2)];
      const th = (x, z) => { const v = api.terrainHeight(x, z); return (v === v) ? v : 0; };
      r.terrAtCam = +th(c.x, c.z).toFixed(2);
      r.terrAtCapy = +th(p.x, p.z).toFixed(2);
      r.camFloor = (api && typeof api.camFloor === 'function') ? +api.camFloor(c.x, c.z).toFixed(2) : null;

      // what the camera can see: cast forward from the camera and report the
      // first hit and its distance.
      const rc = new THREE.Raycaster();
      const dir = new THREE.Vector3();
      g.camera.getWorldDirection(dir);
      rc.set(c.clone(), dir.clone());
      rc.far = 400;
      const hits = rc.intersectObject(g.scene, true).filter(h => h.object.visible);
      r.camHits = hits.slice(0, 4).map(h => ({ d: +h.distance.toFixed(2), n: h.object.name || h.object.type }));

      // DEAD AREA: sample the bounds rectangle and ask, at each point, whether
      // anything at all is drawn within 10 m of it above the ground.
      const b = r.ownBounds || r.genBounds;
      r.grid = [];
      if (b) {
        const bx0 = b.x0 !== undefined ? b.x0 : b[0].x0, bx1 = b.x1 !== undefined ? b.x1 : b[0].x1;
        const bz0 = b.z0 !== undefined ? b.z0 : b[0].z0, bz1 = b.z1 !== undefined ? b.z1 : b[0].z1;
        r.box = [+bx0.toFixed(0), +bx1.toFixed(0), +bz0.toFixed(0), +bz1.toFixed(0)];
        const pts = [];
        const wp = new THREE.Vector3(), m4 = new THREE.Matrix4();
        g.scene.traverse((o) => {
          if (!o.isMesh && !o.isInstancedMesh) return;
          let pp = o, vis = true;
          while (pp) { if (!pp.visible) { vis = false; break; } pp = pp.parent; }
          if (!vis) return;
          const gm = o.geometry; if (!gm) return;
          if (!gm.boundingSphere) { try { gm.computeBoundingSphere(); } catch (e) { return; } }
          const bs = gm.boundingSphere;
          o.updateWorldMatrix(true, false);
          if (o.isInstancedMesh) {
            if (bs && bs.radius > 12) return;
            for (let i = 0; i < o.count; i++) {
              o.getMatrixAt(i, m4); wp.setFromMatrixPosition(m4);
              const sc = Math.max(Math.abs(m4.elements[0]), Math.abs(m4.elements[5]), Math.abs(m4.elements[10]));
              if (bs && bs.radius * sc < 0.40) continue;
              o.localToWorld(wp);
              if (wp.x === wp.x) pts.push(wp.x, wp.z);
            }
          } else {
            if (bs && (bs.radius > 60 || bs.radius < 0.40)) return;
            wp.setFromMatrixPosition(o.matrixWorld);
            if (wp.x === wp.x) pts.push(wp.x, wp.z);
          }
        });
        r.points = pts.length / 2;
        const ow = (api && typeof api.isOverWater === 'function') ? (x, z) => !!api.isOverWater(x, z) : () => false;
        const N = 16;
        let tot = 0, dead = 0, wet = 0;
        const deadPts = [];
        for (let i = 0; i < N; i++) {
          const row = [];
          for (let k = 0; k < N; k++) {
            const x = bx0 + (bx1 - bx0) * (k + 0.5) / N;
            const z = bz0 + (bz1 - bz0) * (i + 0.5) / N;
            if (ow(x, z)) { row.push('~'); wet++; continue; }
            let n = 0;
            for (let j = 0; j < pts.length; j += 2) {
              const dx = pts[j] - x, dz = pts[j + 1] - z;
              if (dx * dx + dz * dz <= 144) { n++; if (n >= 2) break; }
            }
            tot++;
            if (n >= 2) row.push('#');
            else { row.push('.'); dead++; deadPts.push([Math.round(x), Math.round(z)]); }
          }
          r.grid.push(row.join(''));
        }
        r.cells = tot; r.dead = dead; r.wet = wet;
        r.deadPct = tot ? Math.round(100 * dead / tot) : 0;
        r.deadPts = deadPts.slice(0, 60);
      }
      return r;
    }, { tag: tag });
  }

  await page.evaluate(async (o) => {
    await fetch('/shot?name=b9-diag.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, res);
}
