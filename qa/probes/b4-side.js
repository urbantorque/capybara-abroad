async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5500);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(3000);

  const TAG = 'off';
  const CH = ['pasto', 'monaco', 'rio', 'antarctic', 'venice'];
  for (let ci = 0; ci < CH.length; ci++) {
    await page.evaluate(async (q) => {
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
      const g = window.__capy, nm = q.nm;
      if (g.biome.current !== nm) { g.biome.switchTo(nm); await sleep(1200); }
      for (let i = 0; i < 25; i++) g.tick(1 / 60, false);
      const api = (nm === 'sydney') ? g.env : g[nm];
      const th = (x, z) => { const v = api.terrainHeight(x, z); return (typeof v === 'number' && v === v) ? v : NaN; };
      const ow = (typeof api.isOverWater === 'function') ? (x, z) => !!api.isOverWater(x, z) : () => false;
      const sp = g.biome.spawnOf(nm), bb = g.biome.boundsOf(nm);
      const rects = bb ? (bb.rects || [bb]) : [];
      // A UNIFORM slope, not just a steep one: the same gradient at 0.45 m and
      // at 1.5 m, so the picture is of a hillside and not of a break of slope.
      let best = null;
      for (const r of rects) {
        for (let a = 0; a < 28; a++) {
          for (let b = 0; b < 28; b++) {
            const x = r.x0 + (r.x1 - r.x0) * (a + 0.43) / 28;
            const z = r.z0 + (r.z1 - r.z0) * (b + 0.57) / 28;
            if (ow(x, z)) continue;
            const h = th(x, z); if (!(h === h)) continue;
            let uni = true, gx = 0, gz = 0;
            for (const L of [0.45, 0.9, 1.5]) {
              const ax = (th(x + L, z) - th(x - L, z)) / (2 * L);
              const az = (th(x, z + L) - th(x, z - L)) / (2 * L);
              if (!(ax === ax) || !(az === az)) { uni = false; break; }
              if (L === 0.45) { gx = ax; gz = az; }
              else if (Math.abs(ax - gx) > 0.06 || Math.abs(az - gz) > 0.06) { uni = false; break; }
            }
            if (!uni) continue;
            const gr = Math.sqrt(gx * gx + gz * gz);
            if (!(gr > 0.30) || gr > 0.58) continue;
            const d = (x - sp.x) * (x - sp.x) + (z - sp.z) * (z - sp.z);
            if (!best || d < best.d) best = { x: x, z: z, h: h, d: d, gx: gx, gz: gz, gr: gr };
          }
        }
      }
      if (!best) return;
      // face straight up the fall line, so the picture is of PITCH alone
      const yaw = Math.atan2(best.gx, best.gz);
      const b = g.capy.body;
      g.capy.face(yaw); g.capy.carriedBy = null;
      b.position.set(best.x, best.h + 0.5, best.z);
      b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      g.renderer.setSize(1280, 620, false);
      for (let i = 0; i < 80; i++) g.tick(1 / 60, false);
      await sleep(300);
      g.tick(1 / 60, true);
      // side on, level with the animal, across the fall line
      const p = g.capy.renderPosition, side = yaw + Math.PI / 2;
      g.camera.position.set(p.x + Math.sin(side) * 3.4, p.y + 0.15, p.z + Math.cos(side) * 3.4);
      g.camera.lookAt(p.x, p.y - 0.05, p.z);
      g.camera.updateMatrixWorld(true);
      g.renderer.setRenderTarget(null);
      g.renderer.render(g.scene, g.camera);
      const url = g.renderer.domElement.toDataURL('image/png');
      await fetch('/shot?name=b4s-' + q.tag + '-' + nm + '.png', { method: 'POST', body: url.split(',')[1] });
    }, { nm: CH[ci], tag: TAG });
    await page.waitForTimeout(400);
  }
}
