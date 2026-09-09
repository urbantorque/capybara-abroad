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
  // IDENTIFY THE CROWD BY ITS EXACT COUNT AND BY ITS SPREAD, not by "the
  // biggest InstancedMesh in the chapter" — the first cut did that and picked
  // something whose 56 instances all reported a 0.002 facing error, which is
  // not a crowd, it is a probe measuring the wrong object (harness trap 11).
  // venCROWD_N is 48 and quayCROWD_N is 30, and a real crowd is SPREAD OUT.
  const pick = (n) => page.evaluate(function (want) {
    const g = window.__capy;
    const T = g.THREE || window.THREE;
    const root = g.scene.getObjectByName(g.biome.current);
    if (!root) return null;
    const M = new T.Matrix4(), pos = new T.Vector3(), q = new T.Quaternion(), sc = new T.Vector3();
    let best = null;
    root.traverse(function (o) {
      if (!o.isInstancedMesh || o.count !== want) return;
      let sx = 0, sz = 0, n = 0;
      const xs = [];
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, M); M.decompose(pos, q, sc);
        xs.push([pos.x, pos.z]); sx += pos.x; sz += pos.z; n++;
      }
      const cx = sx / n, cz = sz / n;
      let v = 0;
      for (const p of xs) v += (p[0] - cx) * (p[0] - cx) + (p[1] - cz) * (p[1] - cz);
      const spread = Math.sqrt(v / n);
      if (spread > 4 && (!best || spread > best.spread)) {
        best = { uuid: o.uuid, spread: +spread.toFixed(1), cx: +cx.toFixed(1), cz: +cz.toFixed(1), count: o.count };
      }
    });
    return best;
  }, n);
  const measure = (uuid) => page.evaluate(function (id) {
    const g = window.__capy;
    const T = g.THREE || window.THREE;
    const p = g.capy.position;
    let mesh = null;
    g.scene.traverse(function (o) { if (o.uuid === id) mesh = o; });
    if (!mesh) return { missing: true };
    const M = new T.Matrix4(), pos = new T.Vector3(), q = new T.Quaternion(), sc = new T.Vector3();
    const eu = new T.Euler();
    const near = [], far = [];
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, M); M.decompose(pos, q, sc);
      eu.setFromQuaternion(q, 'YXZ');
      const dx = p.x - pos.x, dz = p.z - pos.z;
      const d = Math.hypot(dx, dz);
      let e = Math.atan2(dx, dz) - eu.y;
      e = Math.abs(((e + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      (d < 12 ? near : far).push(e);
    }
    const mean = a => a.length ? +(a.reduce((s, x) => s + x, 0) / a.length).toFixed(3) : null;
    return { nearN: near.length, nearErr: mean(near),
             nearFacing: near.length ? +(near.filter(e => e < 0.6).length / near.length).toFixed(3) : null,
             farN: far.length, farErr: mean(far),
             farFacing: far.length ? +(far.filter(e => e < 0.6).length / far.length).toFixed(3) : null };
  }, uuid);
  for (const [b, n] of [['venice', 48], ['quay', 30]]) {
    await page.evaluate(function (x) { window.__capy.biome.switchTo(x); return true; }, b);
    await wait(4000);
    const m = await pick(n);
    if (!m) { out[b] = { noMesh: true }; continue; }
    // A CONTROL, before the animal is anywhere near them.
    const before = await measure(m.uuid);
    // ...then stand in the middle of them.
    await page.evaluate(function (c) {
      const b2 = window.__capy.capy.body;
      b2.position.set(c.cx, b2.position.y + 1.2, c.cz);
      b2.velocity.set(0, 0, 0);
      return true;
    }, m);
    await wait(3500);
    out[b] = { mesh: m, before: before, after: await measure(m.uuid) };
  }
  out.err = await page.evaluate(() => window.__capy.state.lastError ? String(window.__capy.state.lastError) : null);
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=f4-heads.json', { method: 'POST', body: s }), bl);
}
