async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2500);
  const out = await page.evaluate(async () => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    const g = window.__capy, THREE = g.THREE;
    if (g.biome.current !== 'pasto') { g.biome.switchTo('pasto'); await sleep(1200); }
    for (let i = 0; i < 25; i++) g.tick(1 / 60, false);
    const r = { live: g.biome.current, meshes: [], ring: [] };
    const wp = new THREE.Vector3(), m4 = new THREE.Matrix4();
    const all = [];
    g.scene.traverse((o) => {
      if (!o.isMesh && !o.isInstancedMesh) return;
      let p = o, vis = true;
      while (p) { if (!p.visible) { vis = false; break; } p = p.parent; }
      if (!vis) return;
      const gm = o.geometry; if (!gm) return;
      if (!gm.boundingSphere) { try { gm.computeBoundingSphere(); } catch (e) { return; } }
      let nm = o.name || '', q = o.parent, guard = 0;
      while (q && guard++ < 4) { if (q.name) nm = nm ? (q.name + '/' + nm) : q.name; q = q.parent; }
      o.updateWorldMatrix(true, false);
      const rec = { name: nm || o.type, inst: !!o.isInstancedMesh,
                    count: o.count || 1, r: +gm.boundingSphere.radius.toFixed(1), pts: [] };
      if (o.isInstancedMesh) {
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, m4); wp.setFromMatrixPosition(m4); o.localToWorld(wp);
          if (wp.x === wp.x) rec.pts.push(wp.x, wp.y, wp.z);
        }
      } else {
        wp.setFromMatrixPosition(o.matrixWorld);
        if (wp.x === wp.x) rec.pts.push(wp.x, wp.y, wp.z);
      }
      all.push(rec);
      r.meshes.push({ name: rec.name, inst: rec.inst, count: rec.count, r: rec.r });
    });
    const sp = g.biome.spawnOf('pasto');
    r.spawn = [+sp.x.toFixed(1), +sp.z.toFixed(1)];
    for (let a = 0; a < 12; a++) {
      const th = a / 12 * Math.PI * 2;
      const x = sp.x + Math.cos(th) * 45, z = sp.z + Math.sin(th) * 45;
      const by = {};
      let tot = 0;
      for (const rec of all) {
        let n = 0;
        for (let i = 0; i < rec.pts.length; i += 3) {
          const dx = rec.pts[i] - x, dz = rec.pts[i + 2] - z;
          if (dx * dx + dz * dz <= 100) n++;
        }
        if (n) { by[rec.name + (rec.inst ? ' (inst r' + rec.r + ')' : ' (mesh r' + rec.r + ')')] = n; tot += n; }
      }
      r.ring.push({ deg: Math.round(a * 30), at: [Math.round(x), Math.round(z)], total: tot,
                    by: Object.entries(by).sort((p, q) => q[1] - p[1]).slice(0, 4) });
    }
    return r;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b8-diag.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);
}
