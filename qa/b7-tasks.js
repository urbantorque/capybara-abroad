async page => {
  // ------------------------------------------------------------------------
  // "ZERO TASKS MADE HARDER", MEASURED RATHER THAN ARGUED.
  //
  // Heat is read in nine places and eight of them are a look radius, a
  // cooldown, a line choice, an arm rotation or a music gain — none of which
  // can obstruct anything. The NINTH can: npcHeatGuard points a local's
  // shuffle at their own stock, and a local carries a static collider, so a
  // guard that closed on its stall would be a body placed between the player
  // and a thing the player may have to pick up.
  //
  // So the differential is on THAT: the same 19 chapters, the same settle, the
  // field pinned to zero against the field pinned to one, and for every prop
  // in every chapter the distance from where it lives to the nearest person's
  // collider — plus whether the point it lives on is navigable at all.
  //
  // Both halves also run the whole task table through `game.taskDone`, so a
  // completion set that differed would show up whatever caused it.
  //
  // The chapter list and the task list are both DERIVED. See rule 2.
  // ------------------------------------------------------------------------
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5500);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(3000);

  const META = await page.evaluate(async () => {
    const src = await (await fetch('/src/shared.js', { cache: 'no-store' })).text();
    const i = src.indexOf('export const CHAPTERS = [');
    if (i < 0) throw new Error('b7-tasks: CHAPTERS not found — this audit has gone stale');
    const j = src.indexOf('\n];', i);
    const keys = [];
    for (const m of src.slice(i, j).matchAll(/\bbiome:\s*'([a-z]+)'/g)) keys.push(m[1]);
    if (keys.length < 2) throw new Error('b7-tasks: derived ' + keys.length + ' chapters');
    // The task table, from the same file and the same way.
    const ti = src.indexOf('export const TASKS');
    const ids = [];
    if (ti >= 0) {
      const tj = src.indexOf('\n];', ti);
      for (const m of src.slice(ti, tj).matchAll(/\bid:\s*'([a-z0-9-]+)'/g)) ids.push(m[1]);
    }
    if (ids.length < 100) throw new Error('b7-tasks: derived ' + ids.length + ' task ids — the parse is wrong');
    const g = window.__capy;
    if (typeof g.forceHeat !== 'function') throw new Error('b7-tasks: no forceHeat — build is stale');
    if (typeof g.taskDone !== 'function') throw new Error('b7-tasks: no taskDone');
    return { keys, ids };
  });

  const out = { _chapters: META.keys.length, _tasks: META.ids.length, rows: [] };

  for (const name of META.keys) {
    const r = await page.evaluate(async (a) => {
      const n = a.n, IDS = a.ids;
      const g = window.__capy;
      g.biome.switchTo(n);
      for (let i = 0; i < 120; i++) g.tick(1 / 60, false);
      const live = g.biome.current;
      if (live !== n) return { biome: n, live, err: 'switch failed' };

      // Park the animal well out of the way: this measures the WORLD, and a
      // capybara standing in the square is a second thing moving people.
      const sp = g.biome.spawnOf(n), b = g.capy.body;
      b.position.set(sp.x, sp.y + 40, sp.z);
      b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);

      const locs = (g.locals || []).filter(L => L && L.biome === live);
      const props = (g.props || []).filter(p => p && (!p.biome || p.biome === live) &&
                                                typeof p.homeX === 'number' && isFinite(p.homeX));

      /**
       * TWO NUMBERS, AND THEY ARE THE WHOLE SAFETY ARGUMENT.
       *
       *   drift      the furthest any person has got from the anchor the
       *              chapter chose. npcLOC_STEP_R is 0.55, and heat POINTS the
       *              shuffle rather than lengthening it — so if this is the
       *              same ceiling hot and cold, heat has not put a collider
       *              anywhere the shuffle could not already have put it.
       *   guardWorst the closest any GUARDING person is to any prop's home.
       *              npcHEAT_GD_R is 1.60 and that is the skirt the guard is
       *              forbidden to cross, so a reading under it is the bug.
       *
       * `worst` — the closest ANY person is to any prop — is reported too and
       * is deliberately not the test: it is dominated by where the chapter put
       * people and by the ordinary random shuffle, and comparing it across two
       * windows measures which window ran second. Measured: it moved by up to
       * two metres between two runs of this file with nothing changed.
       */
      function measure() {
        let worst = 1e9, worstOf = null, drift = 0, guard = 0, guardWorst = 1e9, appr = 0;
        for (const L of locs) {
          let dNow = 1e9, dAnc = 1e9;
          for (const p of props) {
            const a = Math.hypot(L.x - p.homeX, L.z - p.homeZ);
            const b2 = Math.hypot(L.ax - p.homeX, L.az - p.homeZ);
            if (a < dNow) dNow = a;
            if (b2 < dAnc) dAnc = b2;
            if (a < worst) { worst = a; worstOf = p.type || '?'; }
            if (L.grd > 0.05 && a < guardWorst) guardWorst = a;
          }
          // HOW MUCH CLOSER TO A PROP THEY HAVE GOT THAN THE CHAPTER PUT THEM.
          // This is the number, and `guardWorst` above is not: a person can
          // carry the guard pose while standing exactly where the chapter put
          // them, and Iceland read 0.65 m for precisely that — a placement,
          // not a movement. The shuffle radius is 0.55 and heat POINTS it
          // rather than lengthening it, so this may never exceed 0.55 in
          // either half, and a hot half that exceeded a cold one would be the
          // bug.
          if (dNow < 1e8 && dAnc - dNow > appr) appr = dAnc - dNow;
          const dd = Math.hypot(L.x - L.ax, L.z - L.az);
          if (dd > drift) drift = dd;
          if (L.grd > 0.05) guard++;
        }
        const done = IDS.filter(id => g.taskDone(id));
        return { worst: worst === 1e9 ? null : +worst.toFixed(2), worstOf,
                 guardWorst: guardWorst === 1e9 ? null : +guardWorst.toFixed(2),
                 appr: +appr.toFixed(3),
                 drift: +drift.toFixed(3), guard, done: done.length, doneIds: done };
      }

      const res = {};
      // HOT, COLD, HOT, COLD. Two windows each, alternating, because a single
      // pair is confounded by which half ran second: the ambient completions
      // in this table are CLOCK-driven (Hong Kong's `symphony` is a show on a
      // thirty-nine second window) and the first cut of this file reported one
      // "only completable cold" that was simply the show coming round again.
      for (const H of [1, 0, 1, 0]) {
        const before = IDS.filter(id => g.taskDone(id));
        g.forceHeat(H);
        // 45 s per window, four windows: npcLOC_STEP_GAP is 15 s jittered to
        // 2.1x, so every person re-targets at least once inside each and most
        // of them twice. A shorter settle measures where the chapter PUT them.
        for (let i = 0; i < 2700; i++) {
          b.position.set(sp.x, sp.y + 40, sp.z);
          b.velocity.set(0, 0, 0);
          b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
          g.tick(1 / 60, false);
        }
        const m = measure();
        m.gained = m.doneIds.filter(id => before.indexOf(id) < 0);
        delete m.doneIds;
        (res['h' + H] || (res['h' + H] = [])).push(m);
      }
      g.forceHeat(-1);
      return { biome: n, live, locals: locs.length, props: props.length, res };
    }, { n: name, ids: META.ids });
    out.rows.push(r);
  }

  await page.evaluate((o) => fetch('/shot?name=B7-tasks.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
