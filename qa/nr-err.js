// THE STANDING ORDER — something on today, in a chapter that was finished.
//
// A regular has five tiers and at five they are done, and because they were
// the only thing in the room with a memory the room is done too. From tier
// three they now hand you a parcel and ask you to pass it on.
//
// ---- THE TIER IS SEEDED THROUGH THE SAVE FILE, like nr-noto.js ----------
// A tier is earned by sitting near somebody until `fam` crosses a bar, at most
// once per visit, so tier three is three visits. `pal` is on the save and the
// restore rebuilds `jrChapPal` from it, which is the same number the errand
// reads through `game.palSet`.
//
// ---- WHAT IT ASSERTS ---------------------------------------------------
//   asked      a parcel appears near the regular when you stand there
//   carried    it can be picked up like any other prop
//   delivered  taking it within npcERR_TO_R of ANYBODY ELSE finishes it
//   forgiven   ...and that takes wariness off the whole chapter and cools the
//              place's heat, which is the payment and the only thing in the
//              game that runs the mischief economy backwards
//   counted    the number reaches the save file
//   quiet      below tier three, nothing happens at all
async page => {
  await page.goto('http://localhost:5188/', { waitUntil: 'load' });
  await page.waitForTimeout(5000);

  const run = async (tier) => {
    // Seed from the TITLE — a live game rewrites the file with its own counts
    // before a reload can land on it (see nr-noto.js's header).
    await page.reload();
    await page.waitForTimeout(5500);
    await page.evaluate((t) => {
      try {
        const pal = {};
        for (let n = 1; n <= 19; n++) pal[n] = t;
        localStorage.setItem('capy3.journey.v1', JSON.stringify({
          v: 1, tasks: ['to-pasto'], seen: [1, 2], recs: {}, ms: 600000,
          chapms: {}, finds: [], foundAt: {}, inc: {}, scn: {}, pho: {}, fed: {},
          pas: {}, pal: pal, rep: {}, biome: 'sydney', fin: 0, slid: 1, slip: 1,
        }));
      } catch (e) {}
    }, tier);
    await page.reload();
    await page.waitForTimeout(6500);
    await page.evaluate(() => {
      const b = document.querySelector('.capyui-carry');
      if (b) b.click();
    });
    await page.waitForTimeout(3500);
    // Venice: its regular is the gondolier, the chapter this whole item was
    // written against in O1, and the ground by him is flat.
    await page.evaluate(() => {
      const g = window.__capy;
      try { g.hud.cross('venice'); } catch (e) { g.biome.switchTo('venice'); }
    });
    await page.waitForTimeout(5000);

    return await page.evaluate((t) => new Promise((res) => {
      const g = window.__capy;
      const live = g.biome.current;
      const mine = g.locals.filter(r => r.biome === live && r.group);
      // ---- FIND THE REGULAR AND BRING THEM TO THE ANIMAL -----------------
      // The ask only fires inside npcERR_R (11 m) and Venice puts you down
      // nowhere near the gondolier, so the first two runs were a coin flip on
      // whether anything happened at all — one said `asked: true` at eight
      // seconds and the next never fired in twenty. `palAudit().found` is the
      // only way in from outside: O1 identifies a regular by a substring of
      // their own first line and npcPAL is module-private, so the coordinates
      // that audit prints are the handle. Matched on position, then moved.
      const pa = g.palAudit ? g.palAudit() : null;
      const row = pa && pa.found && pa.found.find(f => f.b === live);
      let reg = null;
      if (row) {
        for (const r of mine) {
          if (Math.abs(r.x - row.x) < 0.25 && Math.abs(r.z - row.z) < 0.25) { reg = r; break; }
        }
      }
      if (reg) {
        const cp = g.capy.position;
        reg.x = cp.x + 2.6; reg.z = cp.z;
        reg.ax = reg.x; reg.az = reg.z; reg.tx = reg.x; reg.tz = reg.z;
        reg.group.position.set(reg.x, reg.group.position.y, reg.z);
        if (reg.body) {
          reg.body.position.x = reg.x; reg.body.position.z = reg.z;
          reg.body.aabbNeedsUpdate = true;
        }
      }
      const heatN = () => g.heatSites.filter(s => s.biome === live).length;
      const heatSum = () => +g.heatSites.filter(s => s.biome === live)
                              .reduce((s2, s) => s2 + s.h, 0).toFixed(3);
      // ---- SOMETHING TO FORGIVE, MADE THE WAY THE GAME MAKES IT ----------
      // The payment is "wariness comes off and the place cools", and with both
      // at zero that is unmeasurable. Heat is caused rather than poked: two
      // cones dropped at the animal's feet in front of the cast is a bang, a
      // startle and a heat bump, which is the real path.
      for (let i = 0; i < 2; i++) {
        const p = g.capy.position;
        const pr = g.physics.spawnProp('cone', p.x + 1.2 + i * 0.6, p.z + 0.8);
        if (pr && pr.body) {
          pr.disturbed = true;
          pr.lastCapyTouch = g.state ? g.state.time : 0;
          pr.body.wakeUp();
          pr.body.position.y += 2.2;
          pr.body.velocity.set(0, -6, 0);
        }
      }
      const marks = [];
      let asked = false, held = false, delivered = false;
      let waryBefore = -1, heatBeforeN = -1, heatBeforeH = -1;
      let waryAfter = -1, heatAfterN = -1, heatAfterH = -1;
      // ---- THE HEAT IS READ ON THE TWO ADJACENT FRAMES -------------------
      // The first cut read it at PICKUP and again at DELIVERY, seconds apart,
      // and reported the place getting HOTTER across a favour: the cones this
      // probe drops to make something to forgive are still banging about in
      // between, and every bang bumps the site again. The forgive is one
      // multiply on one frame, so the only honest window is the frame before
      // it against the frame after it.
      let heatPrevH = -1, heatPrevN = -1;
      const t0 = performance.now();
      (function step() {
        const now = (performance.now() - t0) / 1000;
        const a = g.errAudit ? g.errAudit() : null;
        if (a && a.on && !asked) asked = true;
        // ---- THE PARCEL IS FOUND AT ANY RANGE, ON PURPOSE ----------------
        // The first cut searched three metres and never found it: the ask
        // fires anywhere inside npcERR_R (11 m) and the parcel is set down
        // beside THEM, not beside you. physGrab has no distance gate of its
        // own — the 1.6 m in capybara.js is the player's reach, not the
        // physics — so a wide search here stands in for walking over, which is
        // not the thing under test.
        if (a && a.on && !a.held && !delivered) {
          const pr = g.physics.nearestGrabbable(g.capy.position, 30);
          if (pr) g.physics.grab(pr);
        }
        if (a && a.held && !held) {
          held = true;
          // ---- THE ZERO IS TAKEN HERE, NOT AT THE START -------------------
          // `wary` decays linearly over npcWARY_T (26 s) and the first cut
          // measured it across a 26-second window, so both rows came back
          // 0.8 -> 0 whether or not an errand happened. Set and read either
          // side of the delivery instead: the gap is under a second, which is
          // three per cent of the decay.
          for (const r of mine) r.wary = 0.8;
          // ...and bring somebody over to receive it. Moving the person and
          // never the animal, like every other probe in this batch.
          for (const r of mine) {
            if (r === reg) continue;
            const cp = g.capy.position;
            r.x = cp.x + 1.6; r.z = cp.z;
            r.ax = r.x; r.az = r.z; r.tx = r.x; r.tz = r.z;
            r.group.position.set(r.x, r.group.position.y, r.z);
            break;
          }
        }
        if (a && a.done > 0 && !delivered) {
          delivered = true;
          waryBefore = 0.8;
          heatBeforeH = heatPrevH; heatBeforeN = heatPrevN;
          waryAfter = +(mine.reduce((s, r) => s + (r.wary || 0), 0) / mine.length).toFixed(3);
          heatAfterN = heatN(); heatAfterH = heatSum();
        }
        heatPrevH = heatSum(); heatPrevN = heatN();
        if (marks.length < 60 && (!marks.length || now - marks[marks.length - 1].t > 0.5)) {
          marks.push({ t: +now.toFixed(1), on: !!(a && a.on),
                       held: !!(a && a.held), done: a ? a.done : -1 });
        }
        if (now < 30 && !delivered) requestAnimationFrame(step);
        else {
          let saved = null;
          try { saved = JSON.parse(localStorage.getItem('capy3.journey.v1') || '{}').err || null; }
          catch (e) {}
          res({
            tier: t, palTier: (g.errAudit && g.errAudit().tier),
            cast: mine.length, regFound: !!reg,
            asked: asked, carried: held, delivered: delivered,
            waryBefore: waryBefore, waryAfter: waryAfter,
            heatBefore: heatBeforeN, heatAfter: heatAfterN,
            heatSumBefore: heatBeforeH, heatSumAfter: heatAfterH,
            done: g.errAudit ? g.errAudit().done : -1,
            savedErr: saved, marks: marks,
          });
        }
      })();
    }), tier);
  };

  const readSave = async () => {
    // The save is on a 700 ms debounce and every row RELOADS, which reseeds
    // the file — so the tally has to be read at the end of the row that wrote
    // it, not at the end of the probe. The first cut read it once at the end
    // and got the second row's freshly seeded (empty) file.
    await page.waitForTimeout(1600);
    return await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem("capy3.journey.v1") || "{}").err || null; }
      catch (e) { return "threw"; }
    });
  };
  const out = {};
  out.tier3 = await run(3); out.tier3.saved = await readSave();
  out.tier1 = await run(1); out.tier1.saved = await readSave();

  await page.evaluate(async (p) => {
    await fetch('/shot?name=NR-ERR', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(p)))) });
  }, out);
}
