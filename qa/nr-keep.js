// CUSTOMS, and THE LINE REMEMBERED — the two additive halves of the batch.
//
// ---- 1. CUSTOMS (npcKeepStep in npc.js) ---------------------------------
// A keepsake is the only object in the game that crosses a border, and until
// now nothing in any of the nineteen chapters reacted to one arriving. The
// test is the mechanism, not the acquisition: a `keep-kyoto` prop carries
// `biome: ''` and `keep: 'kyoto'` however it came to exist, so spawning one in
// Venice and putting it in the animal's mouth is exactly the state a player
// reaches by finishing Kyoto and walking to the departures board.
//
// WHAT IT ASSERTS, and each of these is a different way the feature could be
// dead rather than a restatement of the last one:
//   armed     a line exists at all — the pool resolved and {O} was replaced
//   named     the line contains the OBJECT's name and not the placeholder
//   spent     somebody actually said it, which needs a mouth within 14 m
//   once      a second visit to the same pair says nothing more
//   athome    the same keepsake in ITS OWN chapter arms nothing
//
// ---- 2. THE LINE, REMEMBERED (jrChapLine in systems.js) -----------------
// Read off the SAVE FILE rather than off any in-memory field, because the
// thing being tested is that it survives — an accumulator that never reaches
// localStorage is the same as no accumulator. It also checks the write shape:
// `saveSoon` resets the debounce to zero, so a mark flushed on every frame it
// climbs would keep pushing the write forward and the file would NEVER be
// written. The falling-edge flush is what makes the number appear at all.
async page => {
  await page.goto('http://localhost:5188/', { waitUntil: 'load' });
  await page.waitForTimeout(6500);
  await page.keyboard.press('Space');
  await page.waitForTimeout(3000);

  const out = { customs: [], line: null };

  // ======================================================================
  // 1. CUSTOMS
  // ======================================================================
  for (const pair of [['venice', 'kyoto'], ['goreme', 'manly'], ['kyoto', 'kyoto']]) {
    const here = pair[0], from = pair[1];
    await page.evaluate((n) => {
      const g = window.__capy;
      try { g.hud.cross(n); } catch (e) { g.biome.switchTo(n); }
    }, here);
    await page.waitForTimeout(4500);

    const row = await page.evaluate(async (o) => {
      const g = window.__capy;
      const p = g.capy.position;
      // Put it at the animal's feet and pick it up the way the game does.
      const k = g.physics.spawnKeep(o.from, p.x + 0.6, p.z + 0.2);
      if (!k) return { here: o.here, from: o.from, err: 'no keepsake for that place' };
      g.physics.grab(k);
      const held0 = !!(g.capy.heldProp && g.capy.heldProp.keep === o.from);
      // Walk toward the nearest person, because the line needs a mouth in
      // earshot and the whole design is that it WAITS for one.
      const live = g.biome.current;
      let best = null, bd = 1e9;
      for (const r of g.locals) {
        if (r.biome !== live || !r.group) continue;
        const d = Math.hypot(p.x - r.x, p.z - r.z);
        if (d < bd) { bd = d; best = r; }
      }
      const wait = (ms) => new Promise(r => setTimeout(r, ms));
      // SAMPLED, not read twice. The first cut read the audit at 0 s and at
      // 3.2 s and saw an empty line at both ends — because a person was already
      // 5.7 m away, so the line armed and was SPENT inside the gap, and the
      // probe could not show what it had said. The words are half of what is
      // being tested: {O} is substituted from the prop's own name, and a pool
      // that shipped with the placeholder in it would pass every other check
      // in this file.
      const a0 = g.keepAudit ? g.keepAudit() : null;
      let seen = '';
      for (let i = 0; i < 22; i++) {
        await wait(150);
        const a = g.keepAudit ? g.keepAudit() : null;
        if (a && a.line && !seen) seen = a.line;
      }
      const a1 = g.keepAudit ? g.keepAudit() : null;
      // Now stand next to somebody. Teleporting the ANIMAL is not on — it is
      // the thing under test's own input — so the person is brought to the
      // animal instead, which is a thing a wandering local does anyway.
      if (best) { best.x = p.x + 2.2; best.z = p.z; best.ax = best.x; best.az = best.z;
                  best.tx = best.x; best.tz = best.z;
                  if (best.group) best.group.position.set(best.x, best.group.position.y, best.z); }
      await wait(3200);
      const a2 = g.keepAudit ? g.keepAudit() : null;
      // ...and a second go at exactly the same pair must say nothing.
      await wait(2600);
      const a3 = g.keepAudit ? g.keepAudit() : null;
      return {
        here: o.here, from: o.from, held: held0, nearest: +bd.toFixed(1),
        armedAt0: !!(a0 && a0.line), armedAfterWait: !!(a1 && a1.line),
        line: seen,
        spent: !!(a2 && !a2.line && a2.said > 0),
        said: (a2 && a2.said) || 0, saidLater: (a3 && a3.said) || 0,
        placeholder: seen.indexOf('{O}') >= 0,
      };
    }, { here: here, from: from });
    out.customs.push(row);
  }

  // ======================================================================
  // 2. THE LINE, REMEMBERED
  // ======================================================================
  // The Sahara, because it is the one chapter in the sweep that held a line on
  // all four bearings — the point here is the accumulator and the write, and a
  // chapter that cannot get the animal up to speed tests neither.
  await page.evaluate(() => {
    const g = window.__capy;
    try { g.hud.cross('sahara'); } catch (e) { g.biome.switchTo('sahara'); }
  });
  await page.waitForTimeout(4500);
  const before = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('capy3.journey.v1') || '{}').lin || null; }
    catch (e) { return 'threw'; }
  });
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('KeyD');
  const run = await page.evaluate(() => new Promise((res) => {
    const g = window.__capy;
    let peak = 0;
    const p0 = g.capy.position, x0 = p0.x, z0 = p0.z;
    const t0 = performance.now();
    (function step() {
      const f = (g.state && g.state.flow) || 0;
      if (f > peak) peak = f;
      if (performance.now() - t0 < 14000) requestAnimationFrame(step);
      else res({ peakFlow: +peak.toFixed(2),
                 straight: +Math.hypot(g.capy.position.x - x0, g.capy.position.z - z0).toFixed(1) });
    })();
  }));
  await page.keyboard.up('KeyD');
  await page.keyboard.up('ShiftLeft');
  // Long enough for the streak to fall below the mark AND for the 700 ms save
  // debounce to expire after the flush.
  await page.waitForTimeout(4000);
  const after = await page.evaluate(() => {
    try {
      const f = JSON.parse(localStorage.getItem('capy3.journey.v1') || '{}');
      return { lin: f.lin || null, keys: Object.keys(f).length };
    } catch (e) { return { err: 'threw' }; }
  });
  out.line = { before: before, after: after, run: run };

  await page.evaluate(async (p) => {
    await fetch('/shot?name=NR-KEEP', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(p)))) });
  }, out);
}
