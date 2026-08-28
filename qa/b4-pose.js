async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(3000);

  const CH = ['pasto', 'antarctic', 'rio', 'monaco', 'manly', 'cali', 'goreme',
              'iceland', 'venice', 'kowloon', 'hanoi', 'quay'];
  const out = { started: await page.evaluate(() => !!window.__capy.state.started), rows: [] };

  for (let ci = 0; ci < CH.length; ci++) {
    let row;
    try {
      row = await page.evaluate(async (nm) => {
        const g = window.__capy, THREE = g.THREE;
        if (g.biome.current !== nm) g.biome.switchTo(nm);
        for (let i = 0; i < 25; i++) g.tick(1 / 60, false);
        const r = { biome: nm, live: g.biome.current };
        if (g.biome.current !== nm) return r;
        const api = (nm === 'sydney') ? g.env : g[nm];
        if (!api || typeof api.terrainHeight !== 'function') { r.noTerrain = true; return r; }
        const th = (x, z) => { const v = api.terrainHeight(x, z); return (typeof v === 'number' && v === v) ? v : NaN; };
        const ow = (typeof api.isOverWater === 'function') ? (x, z) => !!api.isOverWater(x, z) : () => false;

        // ---- THE FOUR FEET, as drawn. Not a proxy for them.
        // A leg is a Group at (+-0.15, 0.32, +-0.28) inside capySquash; the foot
        // box is a unit cube at (0, -0.295, 0.03) scaled 0.05 in y, so its
        // underside is at (0, -0.320, 0.03) in the leg's own frame.
        const legs = [];
        g.capy.group.traverse((n) => {
          if (n.isGroup && Math.abs(n.position.y - 0.32) < 0.01 &&
              Math.abs(Math.abs(n.position.x) - 0.15) < 0.01) legs.push(n);
        });
        r.legs = legs.length;
        if (legs.length !== 4) return r;

        const bb = g.biome.boundsOf ? g.biome.boundsOf(nm) : null;
        const sp = g.biome.spawnOf(nm);
        const rects = bb ? (bb.rects || [bb]) : [{ x0: sp.x - 80, x1: sp.x + 80, z0: sp.z - 80, z1: sp.z + 80 }];

        // ---- pick real slopes, biggest first, spread apart
        const cands = [];
        for (const q of rects) {
          const N = 22;
          for (let a = 0; a < N; a++) {
            for (let b = 0; b < N; b++) {
              const x = q.x0 + (q.x1 - q.x0) * (a + 0.43) / N;
              const z = q.z0 + (q.z1 - q.z0) * (b + 0.57) / N;
              if (ow(x, z)) continue;
              const h = th(x, z);
              if (!(h === h)) continue;
              const gx = (th(x + 0.6, z) - th(x - 0.6, z)) / 1.2;
              const gz = (th(x, z + 0.6) - th(x, z - 0.6)) / 1.2;
              if (!(gx === gx) || !(gz === gz)) continue;
              const gr = Math.sqrt(gx * gx + gz * gz);
              // WALKABLE slope only, 11 to 37 degrees. Sorting by steepness alone put
              // every site on a 58 degree cliff face the animal cannot stand on,
              // which measures block 5 rather than the pose.
              if (!(gr > 0.20) || gr > 0.75) continue;
              cands.push({ x: x, z: z, h: h, gr: gr });
            }
          }
        }
        cands.sort((p, q) => q.gr - p.gr);
        const sites = [];
        for (let k = 0; k < cands.length && sites.length < 10; k++) {
          const c = cands[k];
          let far = true;
          for (const s of sites) {
            if ((s.x - c.x) * (s.x - c.x) + (s.z - c.z) * (s.z - c.z) < 400) { far = false; break; }
          }
          if (far) sites.push(c);
        }
        r.sites = sites.length;
        r.slopeDeg = sites.length ? +(Math.atan(sites[0].gr) * 180 / Math.PI).toFixed(1) : null;
        if (!sites.length) { r.flat = true; return r; }

        const ray = new THREE.Raycaster();
        ray.far = 4;
        const org = new THREE.Vector3(), down = new THREE.Vector3(0, -1, 0);
        const lp = new THREE.Vector3();
        const body = g.capy.body;

        // THE ANIMAL IS HIDDEN FOR THE RAY. A ray that starts 0.60 above the
        // foot starts INSIDE the barrel, and the first hit is the capybara's
        // own back: every chapter read a flat -0.51 m before this line existed.
        function groundUnder(p) {
          g.capy.group.visible = false;
          org.set(p.x, p.y + 0.60, p.z);
          ray.set(org, down);
          const hits = ray.intersectObject(g.scene, true);
          for (let k = 0; k < hits.length; k++) {
            let o = hits[k].object, vis = true;
            while (o) { if (!o.visible) { vis = false; break; } o = o.parent; }
            if (vis) { g.capy.group.visible = true; return hits[k].point.y; }
          }
          g.capy.group.visible = true;
          return NaN;
        }

        // A site where the terrain LAW and the DRAWN ground disagree is a site
        // where no pose can be right: the animal is posed on one surface and
        // photographed against another. Counted separately rather than mixed in,
        // because that disagreement is block 3s business and not this blocks.
        let slid = 0, split = 0, agN = 0, agSum = 0;
        let nS = 0, sprSum = 0, sprMax = 0, sprMaxAt = null;
        let gapAbs = 0, gapSum = 0, nF = 0, sunk = 0, flt = 0, worstSunk = 0, worstFloat = 0;
        const YAWS = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
        for (let si = 0; si < sites.length; si++) {
          const s = sites[si];
          const yaw = YAWS[si % 4];
          g.capy.face(yaw);
          g.capy.carriedBy = null;
          body.position.set(s.x, s.h + 0.55, s.z);
          body.velocity.set(0, 0, 0);
          body.angularVelocity.set(0, 0, 0);
          body.previousPosition.copy(body.position);
          body.interpolatedPosition.copy(body.position);
          for (let t = 0; t < 100; t++) g.tick(1 / 60, false);
          if (g.biome.current !== nm) break;
          // it may have slid off the site entirely; that is not a pose sample
          const dsx = body.position.x - s.x, dsz = body.position.z - s.z;
          if (dsx * dsx + dsz * dsz > 36) { slid++; continue; }
          // it may have slid; measure where it actually is
          g.capy.group.updateMatrixWorld(true);
          const lawC = th(g.capy.renderPosition.x, g.capy.renderPosition.z);
          const drC = groundUnder({ x: g.capy.renderPosition.x, y: g.capy.renderPosition.y + 0.30, z: g.capy.renderPosition.z });
          const agree = (lawC === lawC) && (drC === drC) && Math.abs(lawC - drC) <= 0.15;
          let lo = Infinity, hi = -Infinity, bad = false;
          for (let li = 0; li < 4; li++) {
            lp.set(0, -0.320, 0.03);
            legs[li].localToWorld(lp);
            const gy = groundUnder(lp);
            if (!(gy === gy)) { bad = true; break; }
            const gap = lp.y - gy;
            if (!(Math.abs(gap) < 3)) { bad = true; break; }
            nF++; gapSum += gap; gapAbs += Math.abs(gap);
            if (gap > 0.02) flt++; else if (gap < -0.02) sunk++;
            if (gap > worstFloat) worstFloat = gap;
            if (gap < worstSunk) worstSunk = gap;
            if (gap < lo) lo = gap;
            if (gap > hi) hi = gap;
          }
          if (bad) continue;
          const spr = hi - lo;
          nS++; sprSum += spr;
          if (agree) { agN++; agSum += spr; } else split++;
          if (spr > sprMax) { sprMax = spr; sprMaxAt = [Math.round(s.x), Math.round(s.z), +(Math.atan(s.gr) * 180 / Math.PI).toFixed(1)]; }
        }
        r.settled = nS; r.feet = nF; r.slid = slid;
        r.agreeN = agN; r.splitN = split;
        r.spreadAgree = agN ? +(agSum / agN).toFixed(3) : null;
        r.spreadMean = nS ? +(sprSum / nS).toFixed(3) : null;
        r.spreadMax = +sprMax.toFixed(3);
        r.spreadMaxAt = sprMaxAt;
        r.gapMean = nF ? +(gapSum / nF).toFixed(3) : null;
        r.gapAbsMean = nF ? +(gapAbs / nF).toFixed(3) : null;
        r.worstFloat = +worstFloat.toFixed(3);
        r.worstSunk = +worstSunk.toFixed(3);
        r.pctFloat = nF ? +(100 * flt / nF).toFixed(0) : null;
        r.pctSunk = nF ? +(100 * sunk / nF).toFixed(0) : null;
        r.lastError = g.state.lastError ? String(g.state.lastError).slice(0, 120) : null;
        return r;
      }, CH[ci]);
    } catch (e) {
      row = { biome: CH[ci], error: String(e).slice(0, 250) };
    }
    out.rows.push(row);
  }

  await page.evaluate(async (o) => {
    await fetch('/shot?name=b4-pose.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);
}
