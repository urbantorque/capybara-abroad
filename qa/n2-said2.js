async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(4800);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);
  const rows = [];
  for (const arg of [{ b: 'goreme', on: false }, { b: 'goreme', on: true },
                     { b: 'kowloon', on: false }, { b: 'kowloon', on: true }]) {
    const r = await page.evaluate(async (a) => {
      const g = window.__capy;
      const PERCH = ['There is something on it.', 'Does it know?',
        'It has not moved. Neither has that.', 'How long has that been there?',
        'That is not its. That belongs to somebody.',
        'They are just going to stay like that, are they.',
        'I have so many questions.', 'Neither of them is bothered.'];
      const o = { biome: a.b, forced: a.on };
      const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
      // ---- ISOLATE THE LINE FROM THE MECHANIC -----------------------------
      // Getting a real passenger AND a crowd in one place defeated four probe
      // attempts, and what is under test here is not the perch — it is whether
      // npc.js picks the perch pool when something is riding. So the count is
      // STUBBED, and the same run is done with it off as the control.
      if (!g.__realPerchCount) g.__realPerchCount = g.perchCount;
      g.perchCount = a.on ? function () { return 1; } : g.__realPerchCount;
      g.biome.switchTo(a.b);
      tick(150);
      let photoN = 0;
      const said = {}, plain = {};
      g.events.on('npc:photo', function () { photoN++; });
      // `r.fig` IS THE FIRST GATE ON THE PHOTOGRAPH and it is not every person
      // in the chapter — the gesture belongs to the LOCALS (the npcLOC cast),
      // and a probe that stands in the densest crowd of anybody at all can be
      // twenty metres from the nearest person who is allowed to take one.
      // THE LOCALS ARE NOT IN `game.npcs`. They are their own cast with their
      // own array (`game.locals`), and a probe that stands in the densest crowd
      // of `game.npcs` can be twenty metres from the nearest person allowed to
      // take a photograph — `r.fig` is the gesture's first gate.
      const all = (g.locals || []).filter(n => n && typeof n.x === 'number');
      const people = all.filter(n => n.fig);
      o.figN = people.length;
      o.locN = all.length;
      let bestP = null, bestN = -1;
      for (const p of people) {
        let n = 0;
        for (const q of people) {
          const d = Math.hypot(p.x - q.x,
                               p.z - q.z);
          if (d < 9) n++;
        }
        if (n > bestN) { bestN = n; bestP = p; }
      }
      if (!bestP) { o.err = 'nobody speaks here'; return o; }
      const at = { x: bestP.x + 6.2, z: bestP.z + 1.0 };
      // ...AND THE PIN HAS TO COME OFF. Trap 40 says a teleport is motion and
      // pin the body for the length of the test; that is right beside an
      // ANIMAL and wrong beside a PERSON. npc.js shoves the capybara out of a
      // local's personal space every frame, and a pin that snaps it back turns
      // that shove into a position delta the gait reads as walking: restT
      // measured 0.0 for a hundred seconds in four chapters, which reads as a
      // dead loaf and is a probe fighting a separation. Place it once, let it
      // settle, then leave it alone.
      g.capy.body.position.set(at.x, (bestP.y || 0) + 1.6, at.z);
      g.capy.body.velocity.set(0, 0, 0);
      tick(300);
      for (let i = 0; i < 60 * 120; i++) {
        g.tick(1 / 60, false);
        if (i % 15 === 0) {
          for (const n of (g.locals || [])) {
            if (!n || !n.last) continue;
            if (PERCH.indexOf(n.last) >= 0) said[n.last] = 1; else plain[n.last] = 1;
          }
        }
      }
      o.loaf = +g.capy.loaf.toFixed(2);
      o.rest = +g.capy.restT.toFixed(1);
      o.photos = photoN;
      o.perchLines = Object.keys(said).length;
      o.which = Object.keys(said).slice(0, 3);
      o.otherLines = Object.keys(plain).length;
      o.lastError = g.state.lastError || null;
      g.perchCount = g.__realPerchCount;
      return o;
    }, arg);
    rows.push(r);
  }
  await page.evaluate((o) => fetch('/shot?name=n2-said2.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), rows);
}
