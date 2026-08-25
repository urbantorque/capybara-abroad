async page => {
  const out = await page.evaluate(() => {
    const g = window.__capy, o = {};
    const sc = g.scene, T = g.THREE;
    // collect every drawn thing's world-space bounding sphere centre
    const pts = [];
    sc.traverse(n => {
      if (!(n.isMesh || n.isInstancedMesh) || !n.visible) return;
      try {
        if (!n.geometry.boundingSphere) n.geometry.computeBoundingSphere();
        const bs = n.geometry.boundingSphere; if (!bs) return;
        n.updateWorldMatrix(true, false);
        if (n.isInstancedMesh) {
          const m = new T.Matrix4(), v = new T.Vector3();
          for (let i = 0; i < n.count; i++) {
            n.getMatrixAt(i, m); v.setFromMatrixPosition(m).applyMatrix4(n.matrixWorld);
            pts.push([v.x, v.y, v.z]);
          }
        } else {
          const c = bs.center.clone().applyMatrix4(n.matrixWorld);
          pts.push([c.x, c.y, c.z]);
        }
      } catch (e) {}
    });
    o.nPts = pts.length;
    // the route, in order
    const route = [[0,34],[-8.9,26],[-9.3,20.5],[-7.4,0],[0,5],[29,18],[3.6,-7],[-19,0],
                   [0,-40],[0,-56],[0,-74],[0,-100],[0,-130],[0,-152]];
    const cells = [];
    for (let i = 0; i < route.length - 1; i++) {
      const a = route[i], b = route[i+1];
      const len = Math.hypot(b[0]-a[0], b[1]-a[1]);
      const n = Math.max(1, Math.round(len / 20));
      for (let s = 0; s < n; s++) {
        const t = (s + 0.5) / n;
        const cx = a[0] + (b[0]-a[0])*t, cz = a[1] + (b[1]-a[1])*t;
        let near = 0, near10 = 0;
        for (const p of pts) {
          const d = Math.hypot(p[0]-cx, p[2]-cz);
          if (d < 20) { near++; if (d < 10) near10++; }
        }
        cells.push({ x:+cx.toFixed(0), z:+cz.toFixed(0), within20: near, within10: near10 });
      }
    }
    o.cells = cells;
    return o;
  });
  await page.evaluate(async (d) => {
    await fetch('/shot?name=b3hkE.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(d)))) });
  }, out);
}
