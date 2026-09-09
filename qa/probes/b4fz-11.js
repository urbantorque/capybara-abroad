async page => {
  const out = {};
  out.shape = await page.evaluate(() => {
    const g = window.__capy;
    const n = (g.npcs || [])[0];
    return { npcs: (g.npcs || []).length, keys: n ? Object.keys(n).slice(0, 40) : null,
             hasBody: !!(n && n.body), hasGroup: !!(n && n.group),
             ud: n && n.body && n.body.userData ? Object.keys(n.body.userData) : null };
  });
  const names = ['sydney', 'quay', 'cali'];
  out.clear = {};
  for (const nm of names) {
    out.clear[nm] = await page.evaluate((name) => {
      const g = window.__capy;
      g.biome.switchTo(name);
      const sp = g.biome.spawnOf(name), cb = g.capy.body;
      cb.position.set(sp.x, sp.y, sp.z); cb.velocity.set(0, 0, 0);
      cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position);
      for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
      const arr = (g.npcs || []).filter(n => n && n.body && n.group && n.body.userData && n.body.userData.npc);
      if (!arr.length) return { npcsWithBody: 0 };
      let worst = 0, worstOne = null, samples = 0;
      for (let i = 0; i < 60 * 4; i++) {
        // stand ON the nearest one, every frame — the worst case the clearance
        // is written for
        let best = null, bd = 1e9;
        for (const n of arr) {
          const d = Math.hypot(n.group.position.x - cb.position.x, n.group.position.z - cb.position.z);
          if (d < bd) { bd = d; best = n; }
        }
        if (best) {
          cb.position.x = best.group.position.x;
          cb.position.z = best.group.position.z;
          cb.velocity.set(0, 0, 0);
          cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position);
        }
        g.tick(1 / 60, false);
        for (const n of arr) {
          const d = Math.hypot(n.body.position.x - n.group.position.x, n.body.position.z - n.group.position.z);
          samples++;
          if (d > worst) { worst = d; worstOne = { d: +d.toFixed(2), kind: n.kind || n.type || '?',
            body: [+n.body.position.x.toFixed(1), +n.body.position.z.toFixed(1)],
            group: [+n.group.position.x.toFixed(1), +n.group.position.z.toFixed(1)] }; }
        }
      }
      return { npcsWithBody: arr.length, worstBodyVsDrawn: +worst.toFixed(2), worstOne, samples };
    }, nm);
  }
  await page.evaluate(async o => {
    await fetch('/shot?name=b4fz-11.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out);
}
