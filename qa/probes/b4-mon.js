async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(3000);
  const out = await page.evaluate(async () => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    const g = window.__capy, nm = 'monaco';
    if (g.biome.current !== nm) { g.biome.switchTo(nm); await sleep(1200); }
    for (let i = 0; i < 25; i++) g.tick(1 / 60, false);
    const api = g.monaco;
    const th = (x, z) => { const v = api.terrainHeight(x, z); return (typeof v === 'number' && v === v) ? v : NaN; };
    const ow = (typeof api.isOverWater === 'function') ? (x, z) => !!api.isOverWater(x, z) : () => false;
    const sp = g.biome.spawnOf(nm), bb = g.biome.boundsOf(nm);
    const rects = bb ? (bb.rects || [bb]) : [];
    let best = null;
    for (const r of rects) {
      for (let a = 0; a < 26; a++) for (let b = 0; b < 26; b++) {
        const x = r.x0 + (r.x1 - r.x0) * (a + 0.43) / 26;
        const z = r.z0 + (r.z1 - r.z0) * (b + 0.57) / 26;
        if (ow(x, z)) continue;
        const h = th(x, z); if (!(h === h)) continue;
        const gx = (th(x + 0.6, z) - th(x - 0.6, z)) / 1.2;
        const gz = (th(x, z + 0.6) - th(x, z - 0.6)) / 1.2;
        const gr = Math.sqrt(gx * gx + gz * gz);
        if (!(gr > 0.28) || gr > 0.62) continue;
        const d = (x - sp.x) ** 2 + (z - sp.z) ** 2;
        if (!best || d < best.d) best = { x: x, z: z, h: h, d: d, gr: gr };
      }
    }
    let model = null;
    for (const c of g.capy.group.children) if (c.isGroup && c.position.y < -0.1 && c.position.y > -0.9) { model = c; break; }
    const bd = g.capy.body;
    g.capy.face(0.9); g.capy.carriedBy = null;
    bd.position.set(best.x, best.h + 0.5, best.z);
    bd.velocity.set(0, 0, 0); bd.angularVelocity.set(0, 0, 0);
    bd.previousPosition.copy(bd.position); bd.interpolatedPosition.copy(bd.position);
    for (let i = 0; i < 70; i++) g.tick(1 / 60, false);
    return {
      site: [+best.x.toFixed(1), +best.z.toFixed(1), +(Math.atan(best.gr) * 180 / Math.PI).toFixed(1)],
      atHelm: !!g.capy.atHelm, climbing: !!g.capy.climbing, carriedBy: !!g.capy.carriedBy,
      swimming: !!g.capy.swimming, diving: !!g.capy.diving, loaf: +(g.capy.loaf || 0).toFixed(2),
      grounded: !!g.capy.grounded, depth: +(g.capy.depth || 0).toFixed(2),
      rotX: +model.rotation.x.toFixed(3), rotZ: +model.rotation.z.toFixed(3),
      posY: +model.position.y.toFixed(3),
      bodyY: +bd.position.y.toFixed(2), law: +th(bd.position.x, bd.position.z).toFixed(2),
      legRotX: [0, 1, 2, 3].map(() => 0),
    };
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b4-mon.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);
}
