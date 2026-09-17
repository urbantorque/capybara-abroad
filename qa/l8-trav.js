async page => {
  // qa/l8-trav.js — THE FIFTEEN CAMEOS, ALL NINETEEN CHAPTERS
  //
  //   node server.mjs                                 (PORT=5188)
  //   playwright-cli -s=l8 open http://localhost:5188/
  //   playwright-cli -s=l8 run-code --filename=qa/l8-trav.js
  //
  // For every chapter: force its own first tick (`game.state.qaForceChapTick`,
  // systems.js), switch to it, and ask `game.travWhere(biome)` (npc.js,
  // already published — see npcTravWhere's own doc comment) where the
  // traveller is standing. Two checks: it resolves to a real point at all,
  // and it is close to that chapter's own `way` mark (sysMAP_WORLDS,
  // systems.js) — the map's own "way out" marker, so a player who follows
  // the map to the exit finds a person there, not an empty jetty.
  //
  // ---- AN HONEST ADAPTATION, NOT A SILENT ONE ------------------------------
  // `sysMAP_WORLDS` is a systems.js closure-private const; nothing publishes
  // it on `game`, so this file cannot read the live table and instead mirrors
  // the reference points this pass placed each of its fifteen new cameos
  // against (the same numbers used to author each chapter's own
  // `game.addTraveller` call — see the per-file comments). A drift between
  // this table and systems.js's own would only be caught by eye; that is the
  // same risk every hardcoded-reference QA file in this codebase already
  // carries (the Kyoto-miller rule: hardcode the known-good point rather than
  // resolve it live, and say so).
  //
  // Two marks are large LANDMARKS rather than a point (Pasto's crater, rio's
  // rock at Arpoador), so a flat 6 m bound would fail a cameo standing
  // sensibly at their edge; those two get a bound of (landmark radius + 6).
  // manly's own mark is a moving one (the `move-flags` task relocates the
  // flags at runtime) — checked for RESOLUTION only, not distance. The four
  // PRE-EXISTING cameos (quay, sahara, goreme, hanoi) predate this pass and
  // are recorded for information only, never asserted against the 6 m bound
  // — this instrument's job is the fifteen new ones.
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message || e).slice(0, 300)));
  const out = { fail: [], rows: [] };
  const assertTrue = (label, ok) => { if (!ok) out.fail.push(label + ': false (' + JSON.stringify(ok) + ')'); };

  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://localhost:5188/');
  await page.waitForTimeout(6000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);
  const started = await page.evaluate(() => !!(window.__capy && window.__capy.state.started));
  if (!started) throw new Error('l8-trav: the door did not open');

  // { biome: [n, x, z, boundOverride?, informational?, noGround?] }
  const REF = {
    sydney:    [1,  -40,  -21],
    pasto:     [2,  -30,  -66, 17],           // crater rim, radius 11 + 6
    quay:      [3,  -4.5,  21, null, true],   // pre-existing, informational
    // kyoto stands on the Uji bridge's own authored deck height (y=3.16,
    // the same spot the existing tea-local was already proven to stand on)
    // — a generic terrainHeight probe at that (x,z) answers the RIVERBED
    // underneath the bridge, ~7 m below, which is correct ground for the
    // river and simply the wrong question for a person standing on a deck
    // over it. Distance-checked normally; ground-checked not at all.
    kyoto:     [4,    4, 128, null, false, true],
    cali:      [5,   -6,   0],
    // rio.js placed the cameo at rioARPOADOR.x + cos(2.6)*15, .z + sin(2.6)*15
    // (just past the rock's own radius 13) — the exact point, not a round
    // number, so the reference below is that same formula's result.
    rio:       [6,  -74.84, -18.26, 19],      // Arpoador rock, radius 13 + 6
    iceland:   [7,   26, 125],
    sahara:    [8,   0,    0, null, true],    // pre-existing, informational
    drift:     [9,   36, -190],
    venice:    [10,  -1,   10],
    kowloon:   [11,   3,  -64],
    // palawan's own way mark (palJETTY.x, palJETTY.z0+1 = 6,15) sits over the
    // reef flat, not sand — palJETTY.z0=14 is the WATER end of the jetty;
    // dry sand only starts past z>24 (palInZone('beach', x, z)). Treated as
    // a third landmark exception for the same reason pasto/rio are: standing
    // exactly on the mark is not standing on ground at all.
    palawan:   [12,   9,   15, 18],
    goreme:    [13,   0,    0, null, true],   // pre-existing, informational
    manly:     [14,   0,    0, null, true],   // flags move at runtime; resolution-only
    pantanal:  [15,   0,  -93],
    cave:      [16,   3, -163],
    antarctic: [17,   2,   22],
    monaco:    [18, 121,   93],
    hanoi:     [19,   9,   19, null, true],   // pre-existing, informational
  };

  for (const biome of Object.keys(REF)) {
    const [n, rx, rz, boundOverride, informational, noGround] = REF[biome];
    const row = await page.evaluate(([biome, n]) => {
      const g = window.__capy;
      try { g.state.qaForceChapTick(n); } catch (e) {}
      g.biome.switchTo(biome);
      return true;
    }, [biome, n]);
    assertTrue(biome + ': switched to', row === true);
    await page.waitForTimeout(1000);
    const trav = await page.evaluate((biome) => window.__capy.travWhere(biome), biome);
    const resolved = !!(trav && typeof trav.x === 'number' && typeof trav.z === 'number');
    assertTrue(biome + ': travWhere resolves to a point', resolved);
    let dist = null, groundOk = null, groundY = null;
    if (resolved) {
      dist = Math.hypot(trav.x - rx, trav.z - rz);
      groundY = await page.evaluate(([biome, x, z]) => {
        const g = window.__capy;
        const api = biome === 'sydney' ? g.env : g[biome];
        if (!api || typeof api.terrainHeight !== 'function') return null;
        try { const y = api.terrainHeight(x, z); return isFinite(y) ? y : null; } catch (e) { return null; }
      }, [biome, trav.x, trav.z]);
      // A loose tolerance on purpose: a jetty/bridge/pier's own authored deck
      // height legitimately differs from a generic ground function that does
      // not know about the structure sitting on top of it.
      groundOk = groundY === null || Math.abs(trav.y - groundY) < 2.5;
    }
    out.rows.push({ biome, n, resolved, dist: dist === null ? null : Math.round(dist * 10) / 10,
                    groundY, travY: trav ? Math.round(trav.y * 100) / 100 : null, groundOk, informational: !!informational });
    if (!informational && resolved) {
      const bound = boundOverride || 6;
      assertTrue(biome + ': within ' + bound + ' m of its way mark (got ' + dist.toFixed(1) + ')', dist <= bound);
      if (!noGround) assertTrue(biome + ': standing on the ground (not floating/clipped)', groundOk !== false);
    }
  }

  out.errs = errs.slice(0, 10);
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l8-trav.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
  if (out.fail.length || errs.length) {
    throw new Error('l8-trav FAILED: ' + JSON.stringify({ fail: out.fail, errs: out.errs }));
  }
}
