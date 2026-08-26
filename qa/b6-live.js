async page => {
  // ---- ...AND THE BIOMES REALLY CALL IT ----------------------------------
  // qa/b6-recs.js proves the HUD half on every wired id by driving the channel
  // directly. This proves the other half on the attempts that can be opened
  // from a script: the animal is put where the attempt happens and then left
  // alone, and the line is sampled by looking at the DOM. No monkey-patching —
  // if the chapter does not call recordLive, nothing appears.
  const JOBS = [
    // Reykjavik's hot pool: sitting in it IS the attempt, so standing still in
    // the right eight metres of water is the whole test.
    { name: 'hot-spring', key: 'Digit7', at: [-40, 2.0, -10], walk: 0, secs: 8 },
    // The Pantanal cowbird lands on its own within a couple of seconds; the
    // line is gated on the animal MOVING (see the v32 note in pantanal.js), so
    // this one has to walk.
    { name: 'cowbird', key: 'Semicolon', at: null, walk: 12, secs: 12 },
    // Palawan: over the drop-off, holding the dive.
    // Palawan is chapter 12 and chapter 12's picker key is Equal — BracketLeft
    // is chapter 13, which is Cappadocia, which has no water in it at all. The
    // first run of this script spent ten seconds holding the dive key on a
    // Turkish hillside and reported a clean zero.
    { name: 'first-dive', key: 'Equal', at: [8, 0.3, -18], walk: 0, secs: 10, hold: 'KeyE' },
  ];
  const out = [];
  for (let i = 0; i < JOBS.length; i++) {
    const j = JOBS[i];
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload();
    await page.waitForTimeout(5000);
    await page.keyboard.press(j.key);
    await page.waitForTimeout(4000);
    if (j.at) {
      await page.evaluate((a) => {
        const b = window.__capy.capy.body;
        b.position.set(a[0], a[1], a[2]);
        if (b.previousPosition) b.previousPosition.copy(b.position);
        if (b.interpolatedPosition) b.interpolatedPosition.copy(b.position);
        b.velocity.set(0, 0, 0);
        if (b.wakeUp) b.wakeUp();
      }, j.at);
      await page.waitForTimeout(1200);
    }
    await page.evaluate(() => {
      window.__b6 = { n: 0, up: 0, lines: [] };
      window.__b6t = setInterval(function () {
        const el = document.querySelector('.capyui-rec');
        const s = window.__b6;
        s.n++;
        if (el && el.classList.contains('on')) {
          s.up++;
          if (s.lines.length < 4 || s.n % 20 === 0) s.lines.push(el.textContent);
        }
      }, 100);
    });
    if (j.hold) await page.keyboard.down(j.hold);
    if (j.walk) {
      await page.keyboard.down('KeyW');
      await page.waitForTimeout(j.walk * 1000);
      await page.keyboard.up('KeyW');
    }
    const left = j.secs * 1000 - (j.walk ? j.walk * 1000 : 0);
    if (left > 0) await page.waitForTimeout(left);
    if (j.hold) await page.keyboard.up(j.hold);
    out.push(await page.evaluate((n) => {
      clearInterval(window.__b6t);
      const g = window.__capy, p = g.capy.position;
      return { want: n, biome: g.biome.current, samples: window.__b6.n, up: window.__b6.up,
               lines: window.__b6.lines.slice(0, 6),
               at: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)],
               err: (g.state.lastError && String(g.state.lastError)) || '' };
    }, j.name));
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b6-live.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
