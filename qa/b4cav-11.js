async page => {
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 200)));
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(7000);
  const out = await page.evaluate(() => {
    const g = window.__capy;
    const o = {};
    const settle = n => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
    g.biome.switchTo('cave');
    const cav = g.cave, b = g.capy.body, sp = cav.SPAWN;
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    settle(180);
    // ---- THE CAST ----
    const L = (g.locals || []).filter(r => r.biome === 'cave');
    o.locals = L.map(r => ({
      at: [+r.x.toFixed(1), +r.z.toFixed(1)],
      walker: !!r.fig,
      praise: !!r.praise, onTask: r.onTask ? Object.keys(r.onTask) : [],
      lines: (r.lines || []).length,
      after: (r.lines || []).filter(x => x && x.after).length,
      before: (r.lines || []).filter(x => x && x.before).length,
      near: r.near, cool: r.cool
    }));
    const D = cav.doline;
    o.nearestToDoline = L.map(r => +Math.hypot(r.x - D.x, r.z - D.z).toFixed(1)).sort((a, c) => a - c).slice(0, 3);
    // ---- mischief: props with an owner within 11 m ----
    const P = (g.props || []).filter(p => !p.removed && (!p.biome || p.biome === 'cave'));
    let owned = 0; const propAt = [];
    for (const p of P) {
      if (!(p.mass > 0) || p.mass > 12) continue;
      propAt.push([+(p.homeX || 0).toFixed(0), +(p.homeZ || 0).toFixed(0), p.type]);
      for (const r of L) {
        if (!r.fig) continue;
        const dx = (p.homeX || 0) - r.ax, dz = (p.homeZ || 0) - r.az;
        if (dx * dx + dz * dz < 121) { owned++; break }
      }
    }
    o.props = { total: P.length, movable: propAt.length, owned, at: propAt };
    // ---- room tone ----
    o.room = g.hud.roomAudit ? g.hud.roomAudit() : null;
    // ---- ROUTE LIFE: 20 m cells along the main route ----
    const route = [[0, 62], [0, 46], [-12, 30], [-16, 10], [16, -4], [8, -26], [4, -48],
                   [0, -70], [0, -96], [-14, -112], [-30, -126], [22, -132], [0, -150], [0, -166]];
    // one snapshot of every visible object's world position
    const pts = [];
    const v = new g.THREE.Vector3();
    g.scene.updateMatrixWorld(true);
    g.scene.traverse(ob => {
      if (!ob.visible) return;
      if (ob.isInstancedMesh) {
        const m = new g.THREE.Matrix4();
        for (let i = 0; i < ob.count; i++) {
          ob.getMatrixAt(i, m); v.set(m.elements[12], m.elements[13], m.elements[14]);
          v.applyMatrix4(ob.matrixWorld); pts.push([v.x, v.z]);
        }
      } else if (ob.isMesh) { ob.getWorldPosition(v); pts.push([v.x, v.z]); }
    });
    o.scenePts = pts.length;
    const cells = [];
    for (let i = 0; i + 1 < route.length; i++) {
      const a = route[i], c = route[i + 1];
      const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      const n = Math.max(1, Math.round(len / 20));
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        const x = a[0] + (c[0] - a[0]) * t, z = a[1] + (c[1] - a[1]) * t;
        let near = 0;
        for (const p of pts) { const dx = p[0] - x, dz = p[1] - z; if (dx * dx + dz * dz < 144) near++ }
        cells.push({ at: [+x.toFixed(0), +z.toFixed(0)], within12m: near });
      }
    }
    o.cells = cells;
    o.deadCells = cells.filter(c => c.within12m < 6).map(c => c.at);
    // ---- the loaf ----
    g.input.x = 0; g.input.z = 0;
    settle(60 * 12);
    o.loaf = { loaf: +(g.capy.loaf || 0).toFixed(3), grounded: !!g.capy.grounded };
    return o;
  });
  out.errs = errs;
  await page.evaluate(async o => {
    await fetch('/shot?name=b4cav-11.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, out);
}
