async page => {
  await page.addInitScript(() => {
    let s = 0x9e3779b9;
    Math.random = function () {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  });
  await page.goto('http://localhost:5188/', { waitUntil: 'load' });
  await page.waitForTimeout(6000);

  const out = await page.evaluate(() => {
    const g = window.__capy;
    if (!g) return { error: 'no __capy' };
    const CH = ['sydney', 'manly', 'quay', 'kyoto', 'cali', 'rio', 'iceland', 'sahara',
                'drift', 'venice', 'kowloon', 'palawan', 'goreme', 'pantanal', 'cave',
                'antarctic', 'monaco', 'hanoi', 'pasto'];
    const errs = [];
    for (const c of CH) {
      try { g.biome.switchTo(c); } catch (e) { errs.push(c + ': ' + e.message); }
    }

    function hash(arr) {
      let h = 2166136261 >>> 0;
      for (let i = 0; i < arr.length; i++) {
        const q = Math.round(arr[i] * 4096) | 0;
        h ^= q & 255; h = Math.imul(h, 16777619) >>> 0;
        h ^= (q >>> 8) & 255; h = Math.imul(h, 16777619) >>> 0;
        h ^= (q >>> 16) & 255; h = Math.imul(h, 16777619) >>> 0;
      }
      return h.toString(16);
    }
    function pathOf(o) {
      const parts = [];
      for (let p = o; p; p = p.parent) parts.push(p.name || p.type);
      return parts.reverse().join('/');
    }

    const rows = [];
    let totalVerts = 0;
    g.scene.traverse(function (o) {
      if (!o.isMesh && !o.isInstancedMesh) return;
      const ge = o.geometry;
      if (!ge || !ge.attributes || !ge.attributes.position) return;
      if (!o.material || !o.material.vertexColors) return;
      const pa = ge.attributes.position, na = ge.attributes.normal, ca = ge.attributes.color;
      totalVerts += pa.count;
      rows.push({
        path: pathOf(o),
        n: pa.count,
        idx: ge.index ? ge.index.count : 0,
        p: hash(pa.array),
        nrm: na ? hash(na.array) : 'NONE',
        c: ca ? hash(ca.array) : 'NONE'
      });
    });
    rows.sort(function (a, b) {
      return a.path < b.path ? -1 : a.path > b.path ? 1 : (a.n - b.n) || (a.p < b.p ? -1 : 1);
    });
    return { errs: errs, batches: rows.length, totalVerts: totalVerts, rows: rows };
  });

  await page.evaluate(async (payload) => {
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    await fetch('/shot?name=' + payload.tag, { method: 'POST', body: b64 });
  }, Object.assign(out, { tag: 'RV-GEOM' }));
}
