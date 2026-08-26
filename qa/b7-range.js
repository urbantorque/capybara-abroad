async page => {
  // ------------------------------------------------------------------------
  // 2a, MEASURED, IN EVERY CHAPTER: how far away do heads turn, and how many
  // of them, with the field pinned to zero against the field pinned to one.
  //
  // Same build, same script, same order, one lever — game.forceHeat(). That is
  // the differential the batch asks for, and it is cleaner than a git stash
  // because there is nothing else that could have moved between the halves.
  //
  // WHY NOT THE ESCALATION SOAK FOR THIS. Sydney has a sprinkler, a gull mob,
  // an ibis feast and an ice-cream van, all of which startle the crowd on
  // their own clocks, so an attention count taken there is measuring the
  // chapter's own life as much as the animal's. Walking OUT from one person
  // until they stop watching is immune to that: it is one radius, on one
  // record, and the ambient noise is a state the flag does not include.
  //
  // The chapter list is DERIVED. See rule 2 of the pass.
  // ------------------------------------------------------------------------
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5500);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(3000);

  const NAMES = await page.evaluate(async () => {
    const src = await (await fetch('/src/shared.js', { cache: 'no-store' })).text();
    const i = src.indexOf('export const CHAPTERS = [');
    if (i < 0) throw new Error('b7-range: CHAPTERS not found — this audit has gone stale');
    const j = src.indexOf('\n];', i);
    const keys = [];
    for (const m of src.slice(i, j).matchAll(/\bbiome:\s*'([a-z]+)'/g)) keys.push(m[1]);
    if (keys.length < 2) throw new Error('b7-range: derived ' + keys.length + ' chapters');
    const g = window.__capy;
    if (typeof g.forceHeat !== 'function') throw new Error('b7-range: no forceHeat — build is stale');
    for (const k of keys) if (!g.biome[k.toUpperCase() + '_SPAWN']) throw new Error('b7-range: no spawn for ' + k);
    return keys;
  });

  const out = { _chapters: NAMES.length, rows: [] };
  for (const name of NAMES) {
    const r = await page.evaluate(async (n) => {
      const g = window.__capy;
      g.biome.switchTo(n);
      for (let i = 0; i < 150; i++) g.tick(1 / 60, false);
      const live = g.biome.current;
      if (live !== n) return { biome: n, live, err: 'switch failed' };

      const locs = (g.locals || []).filter(L => L && L.biome === live);
      const PA = { vendor: 1, abuela: 1, farmer: 1, churchgoer: 1, llama: 1, streetdog: 1 };
      const cast = (live === 'sydney' || live === 'pasto')
        ? (g.npcs || []).filter(h => h && h.group && ((live === 'pasto') === !!PA[h.kind]))
        : [];

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

      /**
       * THE RANGE AT WHICH THEY TURN, for one person, walked outward in 0.5 m
       * steps until the flag drops and stays down. Locals only: their
       * `watching` comes from ONE test — the watch radius — so the number is
       * that radius and nothing else. The two old casts publish the flag from
       * their state machines, where a gull can set it, and are measured by
       * count instead (below).
       */
      function rangeOf(L) {
        let last = 0;
        for (let d = 1; d <= 40; d += 0.5) {
          put(L.x + d, L.z);
          for (let i = 0; i < 4; i++) g.tick(1 / 60, false);
          if (L.watching) last = d; else if (d > last + 2.5) break;
        }
        return last;
      }
      function counting() {
        let k = 0;
        for (const L of locs) if (L.watching) k++;
        for (const h of cast) if (h.watching) k++;
        return k;
      }
      /** How many people are watching, averaged over a slow pass of the place. */
      function crowdWatch(cx, cz) {
        let sum = 0, m = 0, pk = 0;
        for (let a = 0; a < 8; a++) {
          put(cx + Math.cos(a / 8 * 6.283) * 9, cz + Math.sin(a / 8 * 6.283) * 9);
          for (let i = 0; i < 60; i++) { g.tick(1 / 60, false); const k = counting(); sum += k; m++; if (k > pk) pk = k; }
        }
        return { mean: +(sum / m).toFixed(2), peak: pk };
      }

      // The centre of the cast, so the crowd pass happens where the people are.
      let cx = 0, cz = 0, cn = 0;
      for (const L of locs) { cx += L.x; cz += L.z; cn++; }
      for (const h of cast) { cx += h.group.position.x; cz += h.group.position.z; cn++; }
      if (cn) { cx /= cn; cz /= cn; }

      // Up to four locals, the ones with people nearest them, measured twice.
      const subjects = locs.slice(0, 4);
      const res = {};
      for (const H of [0, 1]) {
        g.forceHeat(H);
        for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
        const rr = subjects.map(L => +rangeOf(L).toFixed(1));
        const cw = crowdWatch(cx, cz);
        res['h' + H] = { range: rr, watch: cw };
      }
      g.forceHeat(-1);
      return { biome: n, live, locals: locs.length, cast: cast.length,
               cx: +cx.toFixed(1), cz: +cz.toFixed(1), res };
    }, name);
    out.rows.push(r);
  }

  await page.evaluate((o) => fetch('/shot?name=B7-range.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
