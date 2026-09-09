async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5500);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(3000);

  const TAG = 'on';
  const CH = ['pasto', 'antarctic', 'rio', 'monaco', 'venice', 'hanoi'];
  for (let ci = 0; ci < CH.length; ci++) {
    for (const mode of ['stand', 'walk']) {
      await page.evaluate(async (q) => {
        function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
        const g = window.__capy, nm = q.nm;
        if (g.biome.current !== nm) { g.biome.switchTo(nm); await sleep(1200); }
        for (let i = 0; i < 25; i++) g.tick(1 / 60, false);
        const api = (nm === 'sydney') ? g.env : g[nm];
        const th = (x, z) => { const v = api.terrainHeight(x, z); return (typeof v === 'number' && v === v) ? v : NaN; };
        const ow = (typeof api.isOverWater === 'function') ? (x, z) => !!api.isOverWater(x, z) : () => false;
        // the same site every run, so the two pictures are the same picture:
        // the steepest walkable point nearest the spawn, chosen deterministically
        const sp = g.biome.spawnOf(nm);
        const bb = g.biome.boundsOf(nm);
        const rects = bb ? (bb.rects || [bb]) : [];
        let best = null;
        for (const r of rects) {
          for (let a = 0; a < 26; a++) {
            for (let b = 0; b < 26; b++) {
              const x = r.x0 + (r.x1 - r.x0) * (a + 0.43) / 26;
              const z = r.z0 + (r.z1 - r.z0) * (b + 0.57) / 26;
              if (ow(x, z)) continue;
              const h = th(x, z); if (!(h === h)) continue;
              const gx = (th(x + 0.6, z) - th(x - 0.6, z)) / 1.2;
              const gz = (th(x, z + 0.6) - th(x, z - 0.6)) / 1.2;
              const gr = Math.sqrt(gx * gx + gz * gz);
              if (!(gr > 0.28) || gr > 0.62) continue;
              const d = (x - sp.x) * (x - sp.x) + (z - sp.z) * (z - sp.z);
              if (!best || d < best.d) best = { x: x, z: z, h: h, d: d, gr: gr };
            }
          }
        }
        if (!best) return;
        const b = g.capy.body;
        g.capy.face(0.9); g.capy.carriedBy = null;
        b.position.set(best.x, best.h + 0.5, best.z);
        b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0);
        b.previousPosition.copy(b.position);
        b.interpolatedPosition.copy(b.position);
        g.input.camYaw = 0.9;
        g.renderer.setSize(1280, 760, false);
        for (let i = 0; i < 70; i++) g.tick(1 / 60, false);
        if (q.mode === 'walk') {
          for (let i = 0; i < 55; i++) { g.input.x = 0.6; g.input.z = 0.8; g.tick(1 / 60, false); }
          g.input.x = 0; g.input.z = 0;
        }
        await sleep(400);
        g.tick(1 / 60, true);
        // The chapter camera sits far enough back that the animal is forty pixels
        // tall, which is no use for judging a pose. Take the picture from a metre
        // and a half instead, on the same overhead-behind line the game uses.
        const p = g.capy.renderPosition, yy = 0.9;
        g.camera.position.set(p.x - Math.sin(yy) * 3.2, p.y + 1.9, p.z - Math.cos(yy) * 3.2);
        g.camera.lookAt(p.x, p.y + 0.15, p.z);
        g.camera.updateMatrixWorld(true);
        g.renderer.setRenderTarget(null);
        g.renderer.render(g.scene, g.camera);
        const url = g.renderer.domElement.toDataURL('image/png');
        await fetch('/shot?name=b4-' + q.tag + '-' + nm + '-' + q.mode + '.png',
                    { method: 'POST', body: url.split(',')[1] });
      }, { nm: CH[ci], mode: mode, tag: TAG });
      await page.waitForTimeout(400);
    }
  }
}
