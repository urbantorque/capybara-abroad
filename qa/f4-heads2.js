async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.reload();
  await wait(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await wait(6500);
  await page.keyboard.press('Digit1');
  await wait(3500);
  const out = {};
  // THE CONFOUND IN THE FIRST CUT: standing at the crowd's centroid in Venice
  // is standing at the campanile, which is what a gawper already faces — so
  // "they are looking at me" and "they are looking at the tower" were the same
  // measurement. Two positions instead, on opposite sides of the same people:
  // heads that FOLLOW keep a low error at both, heads that do not cannot.
  const pick = (want) => page.evaluate(function (n) {
    const g = window.__capy;
    const T = g.THREE || window.THREE;
    const root = g.scene.getObjectByName(g.biome.current);
    if (!root) return null;
    const M = new T.Matrix4(), pos = new T.Vector3(), q = new T.Quaternion(), sc = new T.Vector3();
    let best = null;
    root.traverse(function (o) {
      if (!o.isInstancedMesh || o.count !== n) return;
      let sx = 0, sz = 0; const xs = [];
      for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, M); M.decompose(pos, q, sc);
        xs.push([pos.x, pos.z]); sx += pos.x; sz += pos.z; }
      const cx = sx / o.count, cz = sz / o.count;
      let v = 0; for (const p of xs) v += (p[0]-cx)*(p[0]-cx) + (p[1]-cz)*(p[1]-cz);
      const spread = Math.sqrt(v / o.count);
      if (spread > 4 && (!best || spread > best.spread))
        best = { uuid: o.uuid, spread: +spread.toFixed(1), cx: +cx.toFixed(1), cz: +cz.toFixed(1) };
    });
    return best;
  }, want);
  const at = (x, z) => page.evaluate(function (p) {
    const b = window.__capy.capy.body;
    b.position.set(p.x, b.position.y + 1.0, p.z); b.velocity.set(0, 0, 0);
    return true;
  }, { x, z });
  const measure = (uuid) => page.evaluate(function (id) {
    const g = window.__capy;
    const T = g.THREE || window.THREE;
    const p = g.capy.position;
    let mesh = null;
    g.scene.traverse(function (o) { if (o.uuid === id) mesh = o; });
    if (!mesh) return { missing: true };
    const M = new T.Matrix4(), pos = new T.Vector3(), q = new T.Quaternion(), sc = new T.Vector3();
    const eu = new T.Euler();
    const near = [];
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, M); M.decompose(pos, q, sc);
      eu.setFromQuaternion(q, 'YXZ');
      const dx = p.x - pos.x, dz = p.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d >= 12) continue;
      let e = Math.atan2(dx, dz) - eu.y;
      near.push(Math.abs(((e + Math.PI * 3) % (Math.PI * 2)) - Math.PI));
    }
    near.sort((a, b) => a - b);
    return { n: near.length,
             // The BEST THIRD is the number that matters: only a gawper (Venice)
             // or somebody stopped (the Quay) turns, and that is about a third
             // of each crowd by design. A mean over everybody buries them.
             bestThird: near.length ? +(near.slice(0, Math.max(1, Math.round(near.length / 3)))
                                            .reduce((s, x) => s + x, 0) / Math.max(1, Math.round(near.length / 3))).toFixed(3) : null,
             facing: near.length ? +(near.filter(e => e < 0.4).length / near.length).toFixed(3) : null };
  }, uuid);
  for (const [b, n] of [['venice', 48], ['quay', 30]]) {
    await page.evaluate(function (x) { window.__capy.biome.switchTo(x); return true; }, b);
    await wait(4000);
    const m = await pick(n);
    if (!m) { out[b] = { noMesh: true }; continue; }
    const r = {};
    // At a ROUTE ENDPOINT for the Quay: people there only ever stop at the two
    // ends of their own line, so a spot chosen off the crowd centroid can be
    // twelve metres from everybody who is standing still.
    const spots = b === 'quay'
      ? [['endA', -44 - m.cx + 3, 30.5 - m.cz], ['endB', 44 - m.cx - 3, 33.5 - m.cz], ['endC', -30 - m.cx + 3, 37 - m.cz]]
      : [['east', 9, 0], ['west', -9, 0], ['north', 0, 9]];
    for (const [tag, dx, dz] of spots) {
      await at(m.cx + dx, m.cz + dz);
      await wait(9000);   // long enough for somebody at this end to be on a dwell
      r[tag] = await measure(m.uuid);
    }
    out[b] = { mesh: m, spots: r };
  }
  out.err = await page.evaluate(() => window.__capy.state.lastError ? String(window.__capy.state.lastError) : null);
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=f4-heads2.json', { method: 'POST', body: s }), bl);
}
