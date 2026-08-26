async page => {
  // Diagnostic. Two questions the soak could not answer about its own numbers:
  //   (a) in Sydney, WHY are twenty-odd people "watching" from 26 m?
  //   (b) in the locals chapters, does ANY heat path fire at all, and which?
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5500);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(3000);

  const CHAPS = ['sydney', 'pasto', 'sahara', 'kowloon', 'goreme', 'venice'];
  const out = { rows: [] };

  for (const name of CHAPS) {
    const r = await page.evaluate(async (n) => {
      const g = window.__capy;
      g.biome.switchTo(n);
      for (let i = 0; i < 150; i++) g.tick(1 / 60, false);
      const live = g.biome.current;
      if (live !== n) return { biome: n, live, err: 'switch failed' };
      g.state.heatLog = {};

      const PA = { vendor: 1, abuela: 1, farmer: 1, churchgoer: 1, llama: 1, streetdog: 1 };
      const folk = [];
      for (const L of (g.locals || [])) if (L && L.biome === live) folk.push(L);
      if (live === 'sydney' || live === 'pasto') {
        for (const h of (g.npcs || [])) {
          if (!h || !h.group) continue;
          if ((live === 'pasto') !== !!PA[h.kind]) continue;
          folk.push(h);
        }
      }
      const pos = (p) => p.group ? p.group.position : { x: p.x, y: p.y, z: p.z };
      const fig = folk.filter(f => f.fig !== undefined ? !!f.fig : true).length;

      let stall = null, best = 1e9;
      for (const p of (g.props || [])) {
        if (!p || (p.biome && p.biome !== live)) continue;
        if (typeof p.homeX !== 'number' || !isFinite(p.homeX)) continue;
        const ds = folk.map(f => { const q = pos(f); return Math.hypot(q.x - p.homeX, q.z - p.homeZ); });
        ds.sort((u, v) => u - v);
        const third = ds[Math.min(2, ds.length - 1)];
        if (third < best) { best = third; stall = p; }
      }
      if (!stall) return { biome: n, live, err: 'no props' };
      const sx = stall.homeX, sz = stall.homeZ;

      // does anybody own it?
      const ownable = { mass: stall.mass, keep: !!stall.keep, hidden: !!stall.hidden,
                        removed: !!stall.removed, type: stall.type };
      let ownerD = -1;
      for (const f of folk) {
        if (!f.fig || f.own || f.ownCool > 0 || f.biome !== live) continue;
        const d = Math.hypot(sx - f.ax, sz - f.az);
        if (ownerD < 0 || d < ownerD) ownerD = d;
      }

      function groundY(x, z) {
        try { const api = live === 'sydney' ? g.env : g[live];
              const y = api.terrainHeight(x, z); if (isFinite(y)) return y; } catch (e) {}
        return g.capy.body.position.y - 0.6;
      }
      function put(x, z) {
        const b = g.capy.body;
        b.position.set(x, groundY(x, z) + 0.6, z);
        b.velocity.set(0, 0, 0);
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      }
      /** WHY is somebody watching. */
      function why() {
        const o = { witT: 0, lookAt: 0, chase: 0, flee: 0, shoo: 0, localWatch: 0, tot: 0 };
        for (const f of folk) {
          if (!f.watching) continue;
          o.tot++;
          if (f.fl !== undefined) { o.localWatch++; continue; }   // a local
          if (f.witT > 0) o.witT++;
          else if (f.state === 'lookAt') o.lookAt++;
          else if (f.state === 'chase') o.chase++;
          else if (f.state === 'flee') o.flee++;
          else if (f.state === 'shoo') o.shoo++;
        }
        return o;
      }

      // Park at 26 m and let it settle, with NO events at all.
      put(sx + 26, sz);
      for (let i = 0; i < 300; i++) g.tick(1 / 60, false);
      const idle26 = why();
      const heatIdle = +(g.placeHeat(sx, sz)).toFixed(3);

      // One robbery, at the stall.
      put(sx + 1.6, sz);
      for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
      const wary0 = g.npcHeat(sx, sz, 32);
      try { g.events.emit('capy:grab', { prop: stall, from: null }); } catch (e) {}
      const waryGrab = g.npcHeat(sx, sz, 32);
      try { g.events.emit('capy:graze', stall); } catch (e) {}
      const waryGraze = g.npcHeat(sx, sz, 32);
      const heat1 = +(g.placeHeat(sx, sz)).toFixed(3);
      for (let i = 0; i < 240; i++) g.tick(1 / 60, false);
      put(sx + 26, sz);
      for (let i = 0; i < 300; i++) g.tick(1 / 60, false);
      const hot26 = why();

      // the wariest three, and how far they are from the stall
      const wary = folk.map(f => {
        const q = pos(f);
        return { w: +((f.wary || 0)).toFixed(2), d: +Math.hypot(q.x - sx, q.z - sz).toFixed(1),
                 fig: f.fig !== undefined ? !!f.fig : null, kind: f.kind || 'local' };
      }).sort((a, b) => b.w - a.w).slice(0, 4);

      return { biome: n, live, folk: folk.length, fig, stall: ownable, sx: +sx.toFixed(1), sz: +sz.toFixed(1),
               crowd3: +best.toFixed(1), ownerD: +ownerD.toFixed(1),
               idle26, heatIdle, wary0, waryGrab, waryGraze, heat1, hot26, wary,
               log: g.state.heatLog };
    }, name);
    out.rows.push(r);
  }

  await page.evaluate((o) => fetch('/shot?name=B7-why.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
