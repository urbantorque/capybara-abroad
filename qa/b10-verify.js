async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2500);
  const res = {};

  // ---- SETTLE POINTS WITH NOTHING DRAWN UNDER THEM -----------------------
  // rev-foot's `void` column, for the two chapters this block changed the
  // ground under. Cast from just above the feet (trap 2) with the animal
  // hidden (trap 11).
  for (const tag of ['cave', 'monaco']) {
    res[tag] = await page.evaluate(async (q) => {
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
      const g = window.__capy, THREE = g.THREE;
      if (g.biome.current !== q.tag) { g.biome.switchTo(q.tag); await sleep(1700); }
      g.state.lastError = null;
      for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
      const r = { live: g.biome.current };
      if (r.live !== q.tag) return r;
      const api = g[q.tag];
      const sp = g.biome.spawnOf(q.tag);
      const rc = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
      let n = 0, voids = 0, float = 0, sink = 0, worstF = 0, worstS = 0;
      for (let k = 0; k < 16; k++) {
        const a = k / 16 * Math.PI * 2, R = 18 + (k % 4) * 14;
        const x = sp.x + Math.cos(a) * R, z = sp.z + Math.sin(a) * R;
        const h = api.terrainHeight(x, z);
        if (h !== h) continue;
        if (typeof api.isOverWater === 'function' && api.isOverWater(x, z)) continue;
        const b = g.capy.body;
        g.capy.carriedBy = null;
        b.position.set(x, h + 1.2, z);
        b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0);
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
        for (let i = 0; i < 150; i++) g.tick(1 / 60, false);
        g.tick(1 / 60, true);
        n++;
        const p = g.capy.renderPosition;
        g.capy.group.visible = false;
        rc.set(new THREE.Vector3(p.x, p.y + 0.30, p.z), down); rc.far = 60;
        const hit = rc.intersectObject(g.scene, true).filter(o => o.object.visible)[0];
        g.capy.group.visible = true;
        if (!hit) { voids++; continue; }
        // the model's feet sit about 0.34 below renderPosition
        const gap = (p.y - 0.34) - hit.point.y;
        if (gap > 0.05) { float++; if (gap > worstF) worstF = gap; }
        if (gap < -0.05) { sink++; if (-gap > worstS) worstS = -gap; }
      }
      r.settle = { n: n, voids: voids, float: float, sink: sink,
                   worstFloat: +worstF.toFixed(2), worstSink: +worstS.toFixed(2) };

      // 30 s of ticks, and did anything throw
      for (let i = 0; i < 1800; i++) g.tick(1 / 60, false);
      r.err = g.state.lastError || null;

      // dead area inside the bounds the chapter is actually checked against
      const b2 = (typeof api.bounds === 'function' && api.bounds()) || g.biome.boundsOf(q.tag);
      const rect = b2 && (b2.rects ? b2.rects[0] : b2);
      if (rect) {
        const pts = [];
        const wp = new THREE.Vector3(), m4 = new THREE.Matrix4();
        g.scene.traverse((o) => {
          if (!o.isMesh && !o.isInstancedMesh) return;
          let p2 = o, vis = true;
          while (p2) { if (!p2.visible) { vis = false; break; } p2 = p2.parent; }
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
        const ow = (typeof api.isOverWater === 'function') ? (x, z) => !!api.isOverWater(x, z) : () => false;
        let tot = 0, dead = 0, wet = 0;
        const grid = [];
        for (let i = 0; i < 14; i++) {
          const row = [];
          for (let k = 0; k < 14; k++) {
            const x = rect.x0 + (rect.x1 - rect.x0) * (k + 0.5) / 14;
            const z = rect.z0 + (rect.z1 - rect.z0) * (i + 0.5) / 14;
            if (ow(x, z)) { row.push('~'); wet++; continue; }
            const hh = api.terrainHeight(x, z);
            if (hh !== hh) { row.push(' '); continue; }
            let m = 0;
            for (let j = 0; j < pts.length; j += 2) {
              const dx = pts[j] - x, dz = pts[j + 1] - z;
              if (dx * dx + dz * dz <= 144) { m++; if (m >= 2) break; }
            }
            tot++;
            if (m >= 2) row.push('#'); else { row.push('.'); dead++; }
          }
          grid.push(row.join(''));
        }
        r.box = [Math.round(rect.x0), Math.round(rect.x1), Math.round(rect.z0), Math.round(rect.z1)];
        r.dead = { cells: tot, dead: dead, wet: wet,
                   pct: tot ? Math.round(100 * dead / tot) : 0 };
        r.grid = grid;
      }
      return r;
    }, { tag: tag });
  }

  // ---- frame time, with Sydney as the in-session control -----------------
  res.ms = await page.evaluate(async () => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    const g = window.__capy;
    const out = {};
    for (const tag of ['monaco', 'cave', 'sydney']) {
      if (g.biome.current !== tag) { g.biome.switchTo(tag); await sleep(1500); }
      for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
      const t = [];
      for (let i = 0; i < 180; i++) {
        const t0 = performance.now();
        g.tick(1 / 60, false);
        t.push(performance.now() - t0);
      }
      t.sort((a, b) => a - b);
      out[tag] = { med: +t[90].toFixed(2), p90: +t[162].toFixed(2) };
    }
    return out;
  });

  await page.evaluate(async (o) => {
    await fetch('/shot?name=b10-verify.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, res);
}
