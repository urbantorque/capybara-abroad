async page => {
  // ------------------------------------------------------------------------
  // THE CURVE. Heat rises on witnessed mischief and decays; this is that,
  // sampled, rather than asserted.
  //
  // Three robberies ten seconds apart at one stall, then a hundred and twenty
  // seconds of nothing, sampled twice a second. Real events (`capy:grab` +
  // `capy:graze`, the pair the verbs emit), the field left entirely alone —
  // forceHeat is NOT touched anywhere in this file.
  // ------------------------------------------------------------------------
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5500);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(3000);

  const CHAPS = ['sydney', 'pasto', 'goreme', 'kowloon', 'venice'];
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
      if (!folk.length) return { biome: n, live, err: 'nobody here' };

      let stall = null, best = 1e9;
      for (const p of (g.props || [])) {
        if (!p || (p.biome && p.biome !== live)) continue;
        if (typeof p.homeX !== 'number' || !isFinite(p.homeX)) continue;
        let d0 = 1e9;
        for (const f of folk) {
          const q = pos(f);
          const d = Math.hypot(q.x - p.homeX, q.z - p.homeZ);
          if (d < d0) d0 = d;
        }
        if (d0 < best) { best = d0; stall = p; }
      }
      if (!stall) return { biome: n, live, err: 'no props' };
      const sx = stall.homeX, sz = stall.homeZ;

      function groundY(x, z) {
        try { const api = live === 'sydney' ? g.env : g[live];
              const y = api.terrainHeight(x, z); if (isFinite(y)) return y; } catch (e) {}
        return g.capy.body.position.y - 0.6;
      }
      const b = g.capy.body;
      b.position.set(sx + 1.6, groundY(sx + 1.6, sz) + 0.6, sz);
      b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);

      const at = [], hs = [];
      let t = 0, robbed = 0;
      // 150 s at two samples a second, holding the animal where it stands.
      for (let s = 0; s < 300; s++) {
        if (robbed < 3 && t >= robbed * 10) {
          robbed++;
          try { g.events.emit('capy:grab', { prop: stall, from: null }); } catch (e) {}
          try { g.events.emit('capy:graze', stall); } catch (e) {}
        }
        for (let i = 0; i < 30; i++) {
          b.position.set(sx + 1.6, groundY(sx + 1.6, sz) + 0.6, sz);
          b.velocity.set(0, 0, 0);
          b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
          g.tick(1 / 60, false);
        }
        t += 0.5;
        at.push(+t.toFixed(1));
        hs.push(+(g.placeHeat(sx, sz) || 0).toFixed(3));
      }
      return { biome: n, live, folk: folk.length, stall: stall.type || '?',
               sx: +sx.toFixed(1), sz: +sz.toFixed(1), nearest: +best.toFixed(1),
               at, hs, log: g.state.heatLog };
    }, name);
    out.rows.push(r);
  }

  await page.evaluate((o) => fetch('/shot?name=B7-curve.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
