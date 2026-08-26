async page => {
  // ------------------------------------------------------------------------
  // THE ESCALATION SOAK. Rob the SAME stall three times and measure whether
  // the third approach differs from the first.
  //
  // WHAT MOVED, TWICE, BEFORE THIS PROBE SAID ANYTHING TRUE:
  //
  // 1. `watching` is READ OFF THE RECORD, not inferred from a drawn yaw. The
  //    first cut counted anybody facing within 35 degrees of the bearing to
  //    the capybara and reported a look range of 75.2 m in Sydney and 79.8 m
  //    in Kowloon. That is not attention, it is coincidence — somebody 76 m
  //    away standing still who happens to be pointed the right way.
  //
  // 2. A PEAK IN A WANDERING CROWD IS NOISE. Sydney's 38 people walk, so the
  //    peak look count over an eight-second window came back 19 / 28 / 24 for
  //    three identical robberies. The measurement is now a PROFILE: park the
  //    animal at eight fixed radii from the stall, hold each one long enough
  //    for a head to turn, and record the largest count seen there. The radii
  //    are the same every run, so the rows are directly comparable, and the
  //    outermost radius with anybody on it IS the range answer.
  //
  // MODE is a literal because run-code takes no argument (harness trap 14):
  //   'live' — the field as the player gets it
  //   'off'  — game.forceHeat(0), the same script with the field pinned down
  // ------------------------------------------------------------------------
  const MODE = 'live';

  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5500);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(3000);

  const CHAPS = ['sydney', 'pasto', 'sahara', 'kowloon', 'goreme'];
  const out = { mode: MODE, radii: [20, 16, 12, 8, 4], rows: [] };

  for (const name of CHAPS) {
    const r = await page.evaluate(async (a) => {
      const n = a.n, mode = a.mode, RAD = a.radii;
      const g = window.__capy;
      if (typeof g.forceHeat !== 'function') return { biome: n, err: 'no forceHeat — build is stale' };
      g.forceHeat(mode === 'off' ? 0 : -1);
      g.biome.switchTo(n);
      for (let i = 0; i < 150; i++) g.tick(1 / 60, false);
      const live = g.biome.current;
      if (live !== n) return { biome: n, live, err: 'switch failed' };

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

      // ---- WHICH STALL --------------------------------------------------
      // NOT "the prop with the most people within 20 m", and not "the prop
      // with the closest third-nearest person" either. Both were tried and
      // both picked things nobody is standing at — a bin four metres off a
      // Venetian canal with its nearest people 15 m away, a Cappadocian cone
      // 18.5 m from anybody. Every path into the reaction layer is a RADIUS
      // (thief 6.5, produce 5, ownership 11), so a stall nobody is inside
      // those of is a stall at which the correct answer is nothing happened.
      //
      // Rank on the NEAREST PERSON, which is the same question the game asks.
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
        try {
          const api = live === 'sydney' ? g.env : g[live];
          const y = api.terrainHeight(x, z);
          if (isFinite(y)) return y;
        } catch (e) {}
        return g.capy.body.position.y - 0.6;
      }
      function put(x, z) {
        const b = g.capy.body;
        b.position.set(x, groundY(x, z) + 0.6, z);
        b.velocity.set(0, 0, 0);
        b.previousPosition.copy(b.position);
        b.interpolatedPosition.copy(b.position);
      }
      function looking() {
        let k = 0;
        for (const f of folk) if (f.watching) k++;
        return k;
      }
      /**
       * The attention profile: the peak count at each fixed radius, working in.
       * WALKED between radii rather than jumped. The first cut teleported four
       * metres between stations and reported 3 / 21 / 21 / 21 / 4 / 2 / 2 / 21
       * in Sydney — not a profile, a crowd being startled by an animal
       * appearing next to it, which is a thing the probe was doing and not a
       * thing the game does.
       */
      function profile() {
        const prof = [];
        let at = RAD[0] + 4;
        for (const rr of RAD) {
          while (at > rr) { at = Math.max(rr, at - 0.25); put(sx + at, sz); g.tick(1 / 60, false); }
          let pk = 0;
          for (let i = 0; i < 72; i++) {         // 1.2 s — long enough to turn
            put(sx + rr, sz);
            g.tick(1 / 60, false);
            const k = looking();
            if (k > pk) pk = k;
          }
          prof.push(pk);
        }
        let far = 0, area = 0;
        for (let i = 0; i < RAD.length; i++) { area += prof[i]; if (prof[i] > 0 && RAD[i] > far) far = RAD[i]; }
        return { prof, far, area };
      }

      const runs = [];
      // The state of the square before anything has happened to it at all.
      runs.push(Object.assign({ k: 0, heat: +(g.state.heat || 0).toFixed(3),
                                sites: g.state.heatN, wit: null }, profile()));

      for (let k = 0; k < 3; k++) {
        put(sx + 1.6, sz);
        for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
        // ---- THE ROBBERY: the two events the real verbs emit, in order ----
        const held = g.capy.heldProp;
        const calls0 = g.state.witCalls || 0;
        try { g.events.emit('capy:grab', { prop: stall, from: null }); } catch (e) {}
        try { g.events.emit('capy:graze', stall); } catch (e) {}
        // `witLast` is only WRITTEN by the two chapters that have a witness
        // chain, so reading it anywhere else reports whatever Sydney last did.
        // Gate on the call counter, or the table is full of stale twenties.
        const fired = (g.state.witCalls || 0) > calls0;
        const heatAt = +(g.placeHeat(sx, sz) || 0).toFixed(3);
        // THREE seconds, and the whole pass is short on purpose. The first cut
        // held eight radii for two seconds each and walked between them at
        // 6 m/s, so ONE approach took forty-odd seconds — and against a ninety
        // second decay that means the square has cooled most of the way back
        // before the next robbery. Measured: heat pinned at 0.24 for all three
        // approaches in four chapters, i.e. the probe was destroying the
        // accumulation it exists to measure. Five radii, 1.2 s each.
        for (let i = 0; i < 180; i++) g.tick(1 / 60, false);
        if (held) g.capy.heldProp = held;

        const p = profile();
        runs.push(Object.assign({ k: k + 1,
          heat: heatAt,
          heatLate: +(g.placeHeat(sx, sz) || 0).toFixed(3),
          sites: g.state.heatN,
          wit: fired ? g.state.witLast : null,
          witR: fired ? g.state.witR : null }, p));
      }
      g.forceHeat(-1);
      return { biome: n, live, folk: folk.length, stall: stall.type || '?',
               sx: +sx.toFixed(1), sz: +sz.toFixed(1), crowd3: +best.toFixed(1), runs };
    }, { n: name, mode: MODE, radii: out.radii });
    out.rows.push(r);
  }

  await page.evaluate((o) => fetch('/shot?name=B7-heat-' + o.mode + '.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
