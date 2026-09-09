async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);
  const rows = [];
  for (const nm of ['quay', 'venice', 'goreme', 'rio']) {
    rows.push(await page.evaluate(async (nm) => {
      const g = window.__capy;
      if (g.biome.current !== nm) g.biome.switchTo(nm);
      for (let i = 0; i < 90; i++) g.tick(1 / 60, false);
      const sp = g.biome.spawnOf(nm);
      const L = (g.locals || []).filter(l => l.biome === nm && l.fig)
        .sort((a, b) => Math.hypot(a.x - sp.x, a.z - sp.z) - Math.hypot(b.x - sp.x, b.z - sp.z));
      const r = L[0];
      if (!r) return { biome: nm, err: 'nobody' };
      // stand 2.5 m from them, on the ground, and do nothing at all
      const api = (nm === 'sydney') ? g.env : g[nm];
      const ang = Math.random() * 6.28;
      const px = r.x + Math.cos(ang) * 2.5, pz = r.z + Math.sin(ang) * 2.5;
      const ty = (api && api.terrainHeight) ? api.terrainHeight(px, pz) : 0;
      g.capy.body.position.set(px, ty + 0.8, pz);
      g.capy.body.velocity.set(0, 0, 0);
      const samp = [];
      let heatAt = -1, oneAt = -1;
      for (let i = 0; i < 60 * 120; i++) {
        g.tick(1 / 60, false);
        const t = +(i / 60).toFixed(1);
        if (heatAt < 0 && r.fam > 0.45) heatAt = t;
        if (oneAt < 0 && r.fam >= 0.999) oneAt = t;
        if (i % (60 * 10) === 0) samp.push({ t, fam: +r.fam.toFixed(3), wary: +(r.wary || 0).toFixed(2),
          rest: +(g.capy.restT || 0).toFixed(1), calm: g.calmNow ? +g.calmNow.toFixed(2) : null,
          d: +Math.hypot(g.capy.position.x - r.x, g.capy.position.z - r.z).toFixed(2),
          gnd: !!g.capy.grounded });
      }
      return { biome: nm, near: r.near, first: (r.lines && r.lines[0]) || null,
               heatAt, oneAt, samp, last: r.last || null,
               pho: 0, err: g.state.lastError || null };
    }, nm));
  }
  await page.evaluate((o) => fetch('/shot?name=o1-fam.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), rows);
}
