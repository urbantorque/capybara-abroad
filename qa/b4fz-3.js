async page => {
  await page.waitForTimeout(1000);
  const out = {};
  // ---- A. the sahara rescue loop, and whether it is keepsake-only ---------
  out.sahara = await page.evaluate(() => {
    const g = window.__capy, P = g.physics;
    const kp = P.keepOut('sydney') || P.spawnKeep('sydney', 0, 0);
    if (g.biome.current !== 'sahara') g.biome.switchTo('sahara');
    const sp = g.biome.spawnOf('sahara');
    const cb = g.capy.body;
    cb.position.set(sp.x, sp.y, sp.z); cb.velocity.set(0, 0, 0);
    cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position);
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false);
    const th = g.sahara && g.sahara.terrainHeight ? g.sahara.terrainHeight(kp.homeX, kp.homeZ) : NaN;
    function cycle(p, label) {
      p.body.wakeUp();
      p.body.position.set(950, 12, 950);
      p.body.velocity.set(0, 0, 0);
      p.body.previousPosition.copy(p.body.position);
      p.body.interpolatedPosition.copy(p.body.position);
      let n = 0, lx = 950, ly = 12, lz = 950;
      const ys = [];
      for (let i = 0; i < 420; i++) {
        g.tick(1 / 60, false);
        const b = p.body.position;
        if (Math.hypot(b.x - lx, b.y - ly, b.z - lz) > 3) { n++; ys.push(['R', i, +b.y.toFixed(2)]); }
        lx = b.x; ly = b.y; lz = b.z;
      }
      return { label, type: p.type, home: [+p.homeX.toFixed(2), +p.homeY.toFixed(2), +p.homeZ.toFixed(2)],
               rescues: n, marks: ys.slice(0, 8), endY: +p.body.position.y.toFixed(2),
               sleep: p.body.sleepState };
    }
    const r = { terrUnderKeepHome: (th === th) ? +th.toFixed(2) : 'n/a', keep: cycle(kp, 'keepsake') };
    const cand = g.props.filter(p => !p.removed && !p.hidden && !p.held && p.biome === 'sahara' && p.mass > 0 && p.mass <= 0.6);
    r.controlN = cand.length;
    if (cand.length) r.control = cycle(cand[0], 'sahara prop');
    return r;
  });
  // ---- B. GRAZE against task-critical props -------------------------------
  out.graze = await page.evaluate(() => {
    const g = window.__capy, P = g.physics;
    // which prop types are edible, and which of those a task names
    const edible = [];
    const types = ['sandwich', 'flower', 'icecream', 'chips', 'empanada', 'arepa',
                   'dango', 'maiz', 'plantain', 'coffee', 'ball', 'hat'];
    for (const t of types) { const d = P.typeOf(t); if (d && d.edible) edible.push(t); }
    return { edibleTypes: edible };
  });
  await page.evaluate(async o => {
    await fetch('/shot?name=b4fz-3.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out);
}
