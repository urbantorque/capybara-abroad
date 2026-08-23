async page => {
  await page.reload(); await page.waitForTimeout(5000);
  const names = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland',
                 'sahara', 'drift', 'venice', 'kowloon', 'palawan', 'goreme', 'manly', 'pantanal', 'cave', 'antarctic'];
  const res = { biomes: {} };
  for (const n of names) {
    const r = await page.evaluate(async (name) => {
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
      const g = window.__capy;
      const K = g.CANNON.Body.KINEMATIC;
      g.biome.switchTo(name);
      const sp = g.biome.spawnOf(name), cb = g.capy.body;
      cb.position.set(sp.x, sp.y, sp.z); cb.velocity.set(0, 0, 0);
      cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position);
      await sleep(250);
      const kin = [];
      for (const bd of g.world.bodies) {
        if (bd.type !== K) continue;
        kin.push({ b: bd, lx: bd.position.x, ly: bd.position.y, lz: bd.position.z,
                   moved: 0, tele: 0, maxTele: 0, maxV: 0, frames: 0,
                   label: bd.shapes.length + 'x' + (bd.shapes[0] ? bd.shapes[0].constructor.name : '?') });
      }
      const t0 = performance.now();
      let lastT = t0;
      while (performance.now() - t0 < 2500) {
        await sleep(16);
        const now = performance.now();
        const dt = (now - lastT) / 1000; lastT = now;
        if (dt <= 0 || dt > 0.2) continue;
        for (const k of kin) {
          const p = k.b.position, v = k.b.velocity;
          const d = Math.hypot(p.x - k.lx, p.y - k.ly, p.z - k.lz);
          const vs = Math.hypot(v.x, v.y, v.z);
          k.lx = p.x; k.ly = p.y; k.lz = p.z;
          k.frames++;
          if (d > 0.002) k.moved++;
          if (vs > k.maxV) k.maxV = vs;
          if (d > 0.012 && d > vs * dt * 2.2 + 0.006) { k.tele++; if (d > k.maxTele) k.maxTele = d; }
        }
      }
      return kin.filter(k => k.moved > 3).map(k => ({
        id: k.b.id, label: k.label,
        moved: k.moved, frames: k.frames, tele: k.tele,
        maxTele: +k.maxTele.toFixed(3), maxV: +k.maxV.toFixed(2),
        at: [+k.b.position.x.toFixed(1), +k.b.position.y.toFixed(1), +k.b.position.z.toFixed(1)],
      }));
    }, n);
    res.biomes[n] = r;
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=kine.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, res);
}
