// YOUR REPUTATION ARRIVES FIRST — item 6's last unbuilt half.
//
// `notoTier()` has been computed, tiered and saved since B14, and the only
// thing in the game that ever read it was whether a WANTED poster went up.
// It now decides two things on arrival: which sentence the first person in
// earshot says, and how far the place watches the door for.
//
// ---- THE TIER IS SEEDED THROUGH THE SAVE FILE, ON PURPOSE ----------------
// A real player earns tier 3 at about 1.25 points a minute (measured in B14),
// so twenty minutes of determined trouble per row is not a test anybody runs.
// Writing the counts into `capy3.journey.v1` and RESTORING is not a shortcut
// past the system: `jrChapInc` and `jrChapScene` are exactly what the restore
// branch rebuilds and `notoScore` is a projection over them, so the number
// this produces is the same arithmetic a played file would produce. It also
// exercises the restore path, which poking a runtime field would not.
//
//   score = inc + scn + spread + variety      (sysNOTO_SPREAD and _VAR are 1)
//   tier 0  nothing at all      control: the place behaves as it always has
//   tier 3  'a menace'    36    the reputation line takes the mouth
//   tier 4  'a legend'    60    ...and the alarmed pool takes it instead
//
// ---- NOT addInitScript, AND THAT IS A TRAP THIS FILE WOULD HAVE HIT ------
// It persists per browser CONTEXT, so three registrations do not replace one
// another — all three run on every subsequent load, in order, and every row
// after the first would silently be testing the last file registered. The save
// is written into the live page and the page is reloaded instead.
async page => {
  await page.goto('http://localhost:5188/', { waitUntil: 'load' });
  await page.waitForTimeout(5000);

  const mkInc = (chapters, each) => {
    const inc = {};
    for (let n = 1; n <= chapters; n++) inc[n] = each;
    return inc;
  };
  const CASES = [
    { key: 'quiet',  inc: {},            want: 0 },
    // ---- THE REGRESSION GUARD, AND IT IS THE ROW THAT MATTERS MOST ------
    // B15's place rumour is NOT gated on the tier, deliberately: somebody who
    // caused a scene in Kyoto and nothing anywhere else should still hear
    // about Kyoto in Cali. Item 6 adds a CEILING to that, and a ceiling
    // implemented carelessly is a floor — this row is two incidents in two
    // chapters, score 6, tier 1, and the arrival must still be told about
    // Sydney by name exactly as it was before any of this existed.
    { key: 'rumour', inc: { 1: 2, 2: 2 }, want: 1, expectPlace: true },
    { key: 'menace', inc: mkInc(12, 2),  want: 3 },
    { key: 'legend', inc: mkInc(15, 3),  want: 4 },
  ];

  const out = [];
  for (const c of CASES) {
    // ---- SEED FROM THE TITLE, NOT FROM INSIDE A RUNNING GAME -------------
    // The second and third rows came back `inc 0` — the save had restored, the
    // score was genuinely zero, and the seed was the thing that had gone. A
    // LIVE game writes `inc: jrChapInc` on its own debounce, so setting the
    // file while the previous row's world was still running let that world
    // clobber the seed with its own empty counts before this row's reload ever
    // happened. This first reload drops back to the title, where nothing in
    // the game writes the file at all, and only then is the seed laid down.
    await page.reload();
    await page.waitForTimeout(5500);
    await page.evaluate((o) => {
      try {
        localStorage.removeItem('capy3.album.v1');
        localStorage.setItem('capy3.journey.v1', JSON.stringify({
          v: 1, tasks: ['to-pasto'], seen: [1, 2], recs: {},
          ms: 600000, chapms: {}, finds: [], foundAt: {},
          inc: o.inc, scn: {}, pho: {}, fed: {}, pas: {}, pal: {}, rep: {},
          biome: 'sydney', fin: 0, slid: 1, slip: 1,
        }));
      } catch (e) {}
    }, { inc: c.inc });
    await page.reload();
    await page.waitForTimeout(6500);
    // ---- 'CARRY ON' IS A BUTTON, AND PRESSING ENTER IS NOT CLICKING IT ---
    // The first cut pressed Enter on the title and every row came back tier 0
    // with no line armed — not a failure of the feature, a failure to restore
    // at all. `.capyui-carry` only exists when there is a file, so its absence
    // is the honest signal that the seed did not land, and it is reported.
    const carried = await page.evaluate(() => {
      const b = document.querySelector('.capyui-carry');
      if (!b) return false;
      b.click();
      return true;
    });
    if (!carried) { await page.keyboard.press('Space'); }
    await page.waitForTimeout(3500);

    // ---- SIX ARRIVALS, NOT ONE ------------------------------------------
    // The door term is a radius, and the flow term taught this file what that
    // means: a wider circle is worth nothing unless somebody is standing in
    // the band it just grew into. Göreme alone reported three watchers at tier
    // 0 and three at tier 4 — which is not evidence the term does nothing, it
    // is one spawn with nobody in the band. Whether that is TYPICAL is the
    // question, and it needs more than one doorway to answer.
    // For the place-rumour row the FIRST cross is the one that matters: it is
    // the only arrival whose `from` is a chapter with incidents on it.
    const CH = ['goreme', 'hanoi', 'venice', 'kowloon', 'rio', 'cali'];
    const doors = [];
    let firstLine = null;
    for (const bn of CH) {
      await page.evaluate((n) => {
        const g = window.__capy;
        try { g.hud.cross(n); } catch (e) { g.biome.switchTo(n); }
      }, bn);
      // Read INSIDE the door window (npcNOTO_DOOR is 25 s) and while the
      // animal is standing still, so the flow term is zero and the baseline is
      // clean. A fresh restore has no heat sites either, so the whole of the
      // pre-change radius is exactly `near * 2`.
      await page.waitForTimeout(6000);
      if (firstLine === null) firstLine = await page.evaluate(() => {
        const a = window.__capy.rumourAudit ? window.__capy.rumourAudit() : null;
        return (a && a.line) || "";
      });
      doors.push(await page.evaluate(() => {
        const g = window.__capy;
        function rootOf(o) { let r = null; for (let p = o; p; p = p.parent) r = p; return r; }
        const live = g.biome.current;
        const mine = g.locals.filter(r => r.biome === live && r.group &&
                                          rootOf(r.group) === g.scene);
        const heatOf = typeof g.placeHeat === 'function' ? g.placeHeat : () => 0;
        const p = g.capy.position;
        let ratio = 0, watchers = 0, inBand = 0;
        for (const r of mine) {
          const d = Math.hypot(p.x - r.x, p.z - r.z);
          const base = (r.near || 7) * 2 * (1 + heatOf(r.x, r.z) * 0.6);
          // How many people are standing in the band the door term adds —
          // outside the old radius, inside the new one. This is the ceiling on
          // what the term can ever buy at this doorway, and it is a fact about
          // the chapter rather than about the tier.
          if (d > base && d <= base * 1.4) inBand++;
          if (!r.watching) continue;
          watchers++;
          const q = base > 0 ? d / base : 0;
          if (q > ratio) ratio = q;
        }
        return { biome: live, cast: mine.length, watchers: watchers,
                 inBand: inBand, maxRatio: +ratio.toFixed(3) };
      }));
    }

    const row = await page.evaluate((want) => {
      const g = window.__capy;
      function rootOf(o) { let r = null; for (let p = o; p; p = p.parent) r = p; return r; }
      const live = g.biome.current;
      const mine = g.locals.filter(r => r.biome === live && r.group &&
                                        rootOf(r.group) === g.scene);
      const heatOf = typeof g.placeHeat === 'function' ? g.placeHeat : () => 0;
      const p = g.capy.position;
      let ratio = 0, watchers = 0;
      for (const r of mine) {
        if (!r.watching) continue;
        watchers++;
        const d = Math.hypot(p.x - r.x, p.z - r.z);
        const base = (r.near || 7) * 2 * (1 + heatOf(r.x, r.z) * 0.6);
        const q = base > 0 ? d / base : 0;
        if (q > ratio) ratio = q;
      }
      const na = g.notoAudit ? g.notoAudit() : null;
      const ra = g.rumourAudit ? g.rumourAudit() : null;
      // systems.js's OWN number beside npc.js's copy of it. Three faults share
      // one symptom — the save did not restore, the score is wrong, or npc.js
      // was never handed the tier — and without both sides they cannot be told
      // apart from outside. See game.notoDebug.
      const nd = g.notoDebug ? g.notoDebug() : null;
      return {
        want: want, tier: na && na.tier, doorOn: !!(na && na.on),
        score: nd && nd.score, realTier: nd && nd.tier, inc: nd && nd.inc,
        doorLeft: na && na.door,
        line: (ra && ra.line) || '',
        cast: mine.length, watchers: watchers, maxRatio: +ratio.toFixed(3),
        flow: +((g.state && g.state.flow) || 0).toFixed(2),
      };
    }, c.want);
    row.key = c.key; row.carried = carried; row.doors = doors; row.firstLine = firstLine;
    out.push(row);
  }

  await page.evaluate(async (p) => {
    await fetch('/shot?name=NR-NOTO', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(p)))) });
  }, out);
}
