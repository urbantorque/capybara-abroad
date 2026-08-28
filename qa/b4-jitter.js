async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(3000);

  const CH = ['pasto', 'antarctic', 'rio', 'monaco', 'cali', 'goreme', 'venice', 'hanoi', 'sydney'];
  const out = { rows: [] };
  for (let ci = 0; ci < CH.length; ci++) {
    let row;
    try {
      row = await page.evaluate(async (nm) => {
        const g = window.__capy;
        if (g.biome.current !== nm) g.biome.switchTo(nm);
        for (let i = 0; i < 25; i++) g.tick(1 / 60, false);
        const r = { biome: nm, live: g.biome.current };
        if (g.biome.current !== nm) return r;
        const api = (nm === 'sydney') ? g.env : g[nm];
        const hasT = api && typeof api.terrainHeight === 'function';
        const th = hasT ? (x, z) => { const v = api.terrainHeight(x, z); return (typeof v === 'number' && v === v) ? v : NaN; } : () => 0;
        const ow = (api && typeof api.isOverWater === 'function') ? (x, z) => !!api.isOverWater(x, z) : () => false;

        // capyModel is the child of the root that carries the -capyFOOT_Y offset
        let model = null;
        for (const c of g.capy.group.children) {
          if (c.isGroup && c.position.y < -0.1 && c.position.y > -0.9) { model = c; break; }
        }
        if (!model) { r.noModel = true; return r; }

        // a slope to walk on, or the spawn if the chapter is flat
        const bb = g.biome.boundsOf(nm);
        const rects = bb ? (bb.rects || [bb]) : [];
        let best = null;
        for (const q of rects) {
          for (let a = 0; a < 20; a++) {
            for (let b = 0; b < 20; b++) {
              const x = q.x0 + (q.x1 - q.x0) * (a + 0.43) / 20;
              const z = q.z0 + (q.z1 - q.z0) * (b + 0.57) / 20;
              if (ow(x, z)) continue;
              const h = th(x, z); if (!(h === h)) continue;
              const gx = (th(x + 0.6, z) - th(x - 0.6, z)) / 1.2;
              const gz = (th(x, z + 0.6) - th(x, z - 0.6)) / 1.2;
              const gr = Math.sqrt(gx * gx + gz * gz);
              if (!(gr > 0.20) || gr > 0.60) continue;
              if (!best || gr > best.gr) best = { x: x, z: z, h: h, gr: gr };
            }
          }
        }
        const sp = g.biome.spawnOf(nm);
        const at = best || { x: sp.x, z: sp.z, h: th(sp.x, sp.z) || sp.y || 0, gr: 0 };
        r.deg = +(Math.atan(at.gr) * 180 / Math.PI).toFixed(1);

        const body = g.capy.body;
        g.capy.face(0.7);
        body.position.set(at.x, at.h + 0.5, at.z);
        body.velocity.set(0, 0, 0); body.angularVelocity.set(0, 0, 0);
        body.previousPosition.copy(body.position);
        body.interpolatedPosition.copy(body.position);
        for (let t = 0; t < 60; t++) g.tick(1 / 60, false);

        // walk across the slope for 3 s of real frames, holding the stick
        const px = [], pz2 = [];
        for (let t = 0; t < 180; t++) {
          g.input.x = 0.55; g.input.z = 0.83;
          g.tick(1 / 60, true);
          px.push(model.rotation.x); pz2.push(model.rotation.z);
        }
        g.input.x = 0; g.input.z = 0;

        function jit(a) {
          let s = 0, mx = 0, n = 0;
          for (let i = 2; i < a.length; i++) {
            const d2 = Math.abs(a[i] - 2 * a[i - 1] + a[i - 2]) * 1000;   // milliradians
            s += d2; if (d2 > mx) mx = d2; n++;
          }
          return { mean: +(s / n).toFixed(3), max: +mx.toFixed(2) };
        }
        r.pitch = jit(px); r.roll = jit(pz2);
        r.pitchRange = +(Math.max.apply(null, px) - Math.min.apply(null, px)).toFixed(3);
        r.rollRange = +(Math.max.apply(null, pz2) - Math.min.apply(null, pz2)).toFixed(3);
        r.lastError = g.state.lastError ? String(g.state.lastError).slice(0, 120) : null;
        return r;
      }, CH[ci]);
    } catch (e) { row = { biome: CH[ci], error: String(e).slice(0, 250) }; }
    out.rows.push(row);
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b4-jitter.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);
}
