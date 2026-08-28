async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(3000);

  const CH = ['venice', 'hanoi', 'pasto', 'iceland'];
  const out = { rows: [] };
  for (let ci = 0; ci < CH.length; ci++) {
    let row;
    try {
      row = await page.evaluate(async (nm) => {
        const g = window.__capy, THREE = g.THREE;
        if (g.biome.current !== nm) g.biome.switchTo(nm);
        for (let i = 0; i < 25; i++) g.tick(1 / 60, false);
        const r = { biome: nm, live: g.biome.current, sites: [] };
        if (g.biome.current !== nm) return r;
        const api = (nm === 'sydney') ? g.env : g[nm];
        const th = (x, z) => { const v = api.terrainHeight(x, z); return (typeof v === 'number' && v === v) ? v : NaN; };
        const ow = (typeof api.isOverWater === 'function') ? (x, z) => !!api.isOverWater(x, z) : () => false;
        const legs = [];
        g.capy.group.traverse((n) => {
          if (n.isGroup && Math.abs(n.position.y - 0.32) < 0.01 &&
              Math.abs(Math.abs(n.position.x) - 0.15) < 0.01) legs.push(n);
        });

        const bb = g.biome.boundsOf(nm);
        const rects = bb ? (bb.rects || [bb]) : [];
        const cands = [];
        for (const q of rects) {
          const N = 22;
          for (let a = 0; a < N; a++) {
            for (let b = 0; b < N; b++) {
              const x = q.x0 + (q.x1 - q.x0) * (a + 0.43) / N;
              const z = q.z0 + (q.z1 - q.z0) * (b + 0.57) / N;
              if (ow(x, z)) continue;
              const h = th(x, z); if (!(h === h)) continue;
              const gx = (th(x + 0.6, z) - th(x - 0.6, z)) / 1.2;
              const gz = (th(x, z + 0.6) - th(x, z - 0.6)) / 1.2;
              if (!(gx === gx) || !(gz === gz)) continue;
              const gr = Math.sqrt(gx * gx + gz * gz);
              if (!(gr > 0.20) || gr > 0.75) continue;
              cands.push({ x: x, z: z, h: h, gr: gr });
            }
          }
        }
        cands.sort((p, q) => q.gr - p.gr);
        const sites = [];
        for (let k = 0; k < cands.length && sites.length < 10; k++) {
          const c = cands[k]; let far = true;
          for (const s of sites) if ((s.x - c.x) ** 2 + (s.z - c.z) ** 2 < 400) { far = false; break; }
          if (far) sites.push(c);
        }

        const ray = new THREE.Raycaster(); ray.far = 8;
        const org = new THREE.Vector3(), down = new THREE.Vector3(0, -1, 0), lp = new THREE.Vector3();
        function drawn(x, y, z) {
          g.capy.group.visible = false;
          org.set(x, y, z); ray.set(org, down);
          const hits = ray.intersectObject(g.scene, true);
          let res = { y: NaN, name: '' };
          for (let k = 0; k < hits.length; k++) {
            let o = hits[k].object, vis = true;
            while (o) { if (!o.visible) { vis = false; break; } o = o.parent; }
            if (vis) { res = { y: hits[k].point.y, name: hits[k].object.name || '(unnamed)' }; break; }
          }
          g.capy.group.visible = true;
          return res;
        }

        const body = g.capy.body;
        const YAWS = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
        for (let si = 0; si < sites.length; si++) {
          const s = sites[si];
          g.capy.face(YAWS[si % 4]); g.capy.carriedBy = null;
          body.position.set(s.x, s.h + 0.55, s.z);
          body.velocity.set(0, 0, 0); body.angularVelocity.set(0, 0, 0);
          body.previousPosition.copy(body.position);
          body.interpolatedPosition.copy(body.position);
          for (let t = 0; t < 100; t++) g.tick(1 / 60, false);
          if (g.biome.current !== nm) break;
          const dx = body.position.x - s.x, dz = body.position.z - s.z;
          if (dx * dx + dz * dz > 36) { r.sites.push({ at: [+s.x.toFixed(0), +s.z.toFixed(0)], slid: 1 }); continue; }
          g.capy.group.updateMatrixWorld(true);
          const px = g.capy.renderPosition.x, pz = g.capy.renderPosition.z, py = g.capy.renderPosition.y;
          const law = th(px, pz);
          const dr = drawn(px, py + 0.9, pz);
          const gaps = [];
          for (let li = 0; li < 4; li++) {
            lp.set(0, -0.320, 0.03); legs[li].localToWorld(lp);
            const d = drawn(lp.x, lp.y + 0.60, lp.z);
            gaps.push(+(lp.y - d.y).toFixed(3));
          }
          r.sites.push({
            at: [+px.toFixed(1), +pz.toFixed(1)],
            deg: +(Math.atan(s.gr) * 180 / Math.PI).toFixed(1),
            law: +law.toFixed(3),
            drawnY: +dr.y.toFixed(3),
            drawnObj: dr.name,
            lawVsDrawn: +(law - dr.y).toFixed(3),
            bodyOverLaw: +(py - 0.34 - law).toFixed(3),
            gaps: gaps,
            spread: +(Math.max.apply(null, gaps) - Math.min.apply(null, gaps)).toFixed(3),
          });
        }
        return r;
      }, CH[ci]);
    } catch (e) { row = { biome: CH[ci], error: String(e).slice(0, 250) }; }
    out.rows.push(row);
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b4-diag.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);
}
