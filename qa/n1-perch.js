async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(4800);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  const PLACES = ['sydney', 'venice', 'goreme', 'kyoto', 'manly', 'antarctic'];
  const rows = [];
  for (const b of PLACES) {
    const r = await page.evaluate(async (bi) => {
      const g = window.__capy;
      const out = { biome: bi, started: g.state.started };
      const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
      try {
        g.completeTask('gather', true);          // the herd skill, the honest way
        // ...AND THE FLOAT, WHICH KYOTO TURNS OUT TO NEED. Both of the heron's
        // wade points are inside kyoPOND (68 m by 44), so the only ground
        // within the herd's fifteen-metre earshot of it is water — and the
        // loaf's busy list has swimming on it unless `float` is learnt. Measured
        // 8 Sep: a twenty-four candidate dry-land ring round the bird found
        // nothing, and `swimming: true` with `loaf: 0` for thirty seconds while
        // the bird stood there led. The heron is perchable FROM THE WATER.
        g.completeTask('the-crossing', true);
        g.biome.switchTo(bi);
      } catch (e) { out.err = String(e && e.message); return out; }
      tick(120);
      out.canHerd = g.capy.can('herd');
      const live = () => g.herdDebug().kinds[0] || null;
      // THE HERON IS ONLY OFFERED WHILE IT IS STANDING and it spends a fifth of
      // its cycle in the air, so wait for phase 0 rather than measuring the
      // half of the runs that start mid-flight.
      let kind = live();
      for (let w = 0; w < 40 && (!kind || !kind.n || !kind.first); w++) { tick(60); kind = live(); }
      if (!kind || !kind.n || !kind.first) { out.err = 'nothing offered'; return out; }
      // TRAP 40: a teleport is motion, and every gate here is on stillness.
      // Pin x and z for the whole test and let y settle on its own — pinning y
      // as well leaves the animal off the ground and `capyBusy` never clears.
      // THE STAND-OFF IS OUTSIDE THE FLUSH RADIUS. kyoHERON_NEAR is 9 m and
      // herd earshot is 15, so the heron has to be asked from about twelve;
      // a probe that stands next to it flushes it and measures n: 0.
      const far = bi === 'kyoto' ? 12.0 : 2.6;
      const tgt = kind.first;
      // ...AND IT HAS TO BE DRY LAND. The loaf's own busy list has swimming on
      // it, so a probe that drops the animal in the heron's pond measures
      // `loaf: 0` for thirty seconds against a mechanic that is working. Walk a
      // ring at the stand-off distance and take the first bearing that settles
      // grounded, out of the water and off a slope.
      // ...AND THE SEARCH IS ITSELF AN EXPERIMENT (trap 18). A forty-eight
      // candidate ring at eighty ticks each is sixty-four seconds of world
      // time: on the first attempt it flooded the Venetian square, walked the
      // Manly gulls out of earshot and bled every heard counter to zero, and
      // five of six chapters reported a mechanic that had worked the run
      // before. Only Kyoto needs one — its animal stands in a pond — so only
      // Kyoto pays for one.
      let px = tgt.x + far * 0.71, pz = tgt.z + far * 0.71, found = null;
      if (bi === 'kyoto') {
        // kyoPOND is 68 m by 44 and the heron wades in the middle of it, so
        // the nearest dry ground is 12–14 m away and herd earshot is 15: there
        // is a two-metre annulus where the bird is both askable and standable
        // from, and a ring at one radius misses it.
        const R = [far, far * 1.14, far * 1.23];
        for (let a = 0; a < 24 && !found; a++) {
          const th = (a % 8) * Math.PI / 4;
          const rr = R[(a / 8) | 0];
          const cx = tgt.x + Math.sin(th) * rr, cz = tgt.z + Math.cos(th) * rr;
          g.capy.body.position.set(cx, tgt.y + 1.4, cz);
          g.capy.body.velocity.set(0, 0, 0);
          let ok = 0;
          for (let i = 0; i < 45; i++) {
            g.capy.body.position.x = cx; g.capy.body.position.z = cz;
            g.capy.body.velocity.set(0, 0, 0);
            g.tick(1 / 60, false);
            if (i > 28 && g.capy.grounded && !g.capy.swimming) ok++;
          }
          if (ok > 10) found = { x: +cx.toFixed(2), z: +cz.toFixed(2) };
        }
        // the heron may have flown while the ring was walked; wait it back down
        for (let w = 0; w < 40 && !(live() && live().n); w++) tick(60);
      }
      out.stand = found;
      if (found) { px = found.x; pz = found.z; }
      const pin = () => {
        g.capy.body.position.x = px; g.capy.body.position.z = pz;
        g.capy.body.velocity.set(0, 0, 0);
        g.capy.body.angularVelocity.set(0, 0, 0);
      };
      g.capy.body.position.set(px, tgt.y + 0.8, pz);
      tick(1);
      for (let i = 0; i < 240; i++) { pin(); g.tick(1 / 60, false); }
      out.grounded = g.capy.grounded;
      out.swimming = g.capy.swimming;
      out.settleY = +g.capy.position.y.toFixed(2);
      // ---- wheek until it is following ------------------------------------
      // the counter decays (herdHEARD_T 7.5 s) so the asking has to be quick
      for (let w = 0; w < 5; w++) {
        pin();
        g.events.emit('capy:wheek', { position: g.capy.position, soft: false });
        for (let i = 0; i < 30; i++) { pin(); g.tick(1 / 60, false); }
      }
      out.after_wheek = live();
      // ---- ...and then sit still ------------------------------------------
      // capyLOAF_T is 6.5 s, the loaf then damps past 0.80, and perchWAIT is
      // 2.2 s on top of that. A wheek every ten seconds because the company is
      // on herdHOLD (21 s) and a passenger is on the herd's clock — rule 2.
      const trace = [];
      for (let i = 0; i < 60 * 30; i++) {
        pin();
        if (i > 0 && i % 600 === 0) g.events.emit('capy:wheek', { position: g.capy.position, soft: false });
        g.tick(1 / 60, false);
        if (i % 180 === 0) {
          const k = live();
          trace.push({ t: +(i / 60).toFixed(1), loaf: +g.capy.loaf.toFixed(2),
                       on: g.perchCount(), led: k ? k.led : -1 });
        }
      }
      out.trace = trace;
      out.loaf = +g.capy.loaf.toFixed(3);
      out.perch = g.perchDebug();
      const seat = {};
      g.capy.back(0, seat);
      out.seatOverFeet = +(seat.y - (g.capy.position.y - 0.34)).toFixed(3);
      // ---- and then WALK, which is the whole point ------------------------
      const errs = [];
      for (let i = 0; i < 60 * 4; i++) {
        g.capy.body.velocity.x = 3.0;
        if (i % 300 === 0) g.events.emit('capy:wheek', { position: g.capy.position, soft: false });
        g.tick(1 / 60, false);
        if (i % 40 === 0) {
          const dd = g.perchDebug();
          errs.push({ on: dd.on, err: dd.kinds.length ? dd.kinds[0].err : -1 });
        }
      }
      out.walk = errs;
      out.after_walk = g.perchDebug().on;
      out.most = g.perchDebug().most;
      // ---- ...and a hop takes everybody off -------------------------------
      g.capy.launch(0, 6, 0);
      for (let i = 0; i < 30; i++) g.tick(1 / 60, false);
      out.after_hop = g.perchDebug().on;
      out.lastError = g.state.lastError || null;
      return out;
    }, b);
    rows.push(r);
  }
  await page.evaluate((o) => fetch('/shot?name=n1-perch.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), rows);
}
