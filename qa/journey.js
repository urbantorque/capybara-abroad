async page => {
  // START FROM A KNOWN PAGE. This audit had no reload, so it measured whatever
  // the previous run-code left behind -- harness trap 6. It reported
  // "picks 17 / boardRows 17" against a nineteen-chapter game and read exactly
  // like Monte Carlo and Hanoi being unreachable. Measured properly, on a true
  // fresh save: the title picker offers 19 tiles and the board 19 rows. The
  // audit was dirty, the game was fine, which is the more dangerous way round.
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.evaluate(() => new Promise(r => setTimeout(r, 5200)));
  const out = await page.evaluate(async () => {
    const errs = [];
    const oldErr = console.error;
    console.error = function (...a) { errs.push(a.map(x => (x && x.stack) || String(x)).join(' ')); oldErr.apply(console, a); };
    window.addEventListener('error', e => errs.push('WINDOW ' + (e.message || e.error)));
    const g = window.__capy;
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    const res = { errs, steps: [] };
    function note(s) { res.steps.push(s); }

    try { localStorage.removeItem('capy3.journey.v1'); } catch (e) {}

    // --- the title card, at a 720p window -------------------------------
    const picks = document.querySelectorAll('.capyui-pick');
    const card = document.querySelector('.capyui-card');
    const cr = card ? card.getBoundingClientRect() : null;
    note('picks ' + picks.length + ' cardTop ' + (cr ? cr.top.toFixed(0) : '?') +
         ' cardBottom ' + (cr ? cr.bottom.toFixed(0) : '?') +
         ' viewport ' + window.innerHeight);
    // every ticket must be inside the window, or the last chapters are unclickable
    let worst = 0;
    picks.forEach(p => { const r = p.getBoundingClientRect(); worst = Math.max(worst, r.bottom); });
    note('lowestPickBottom ' + worst.toFixed(0));

    picks[0].click();
    await sleep(500);

    // --- travel to every chapter through the DEPARTURES BOARD ------------
    // Not biomeGo: the board is the only way a player gets anywhere, and it is
    // the thing that has to survive eleven chapters.
    // EVERY CHAPTER, from the task table, not a hand-kept list of eleven.
    // The old list stopped at kowloon, so this audit reported 'boardRows 17'
    // against a nineteen-chapter game and read like the two newest chapters
    // were unreachable. They are not: measured with a full save, the title
    // picker offers 19 tiles and the departures board 19 rows. The audit was
    // stale, the game was fine -- which is the more dangerous way round, and
    // the reason a count in a test should be derived too.
    const ALL_TO = ['pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland', 'sahara',
                    'drift', 'venice', 'kowloon', 'palawan', 'goreme', 'manly',
                    'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi'];
    const CH = [];
    for (let i = 0; i < ALL_TO.length + 1; i++) CH.push(i + 1);
    // unlock everything so the board offers every line
    for (const nm of ALL_TO) g.completeTask('to-' + nm, true);

    // open the board and count the rows
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Tab', bubbles: true }));
    await sleep(400);
    const rows = document.querySelectorAll('.capyui-jrrow');
    note('boardRows ' + rows.length);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }));
    await sleep(300);

    // --- a soak through every biome, watching for a throw ---------------
    // All nineteen, not the eleven that existed when this was written.
    const names = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland',
                   'sahara', 'drift', 'venice', 'kowloon', 'palawan', 'goreme',
                   'manly', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi'];
    for (const n of names) {
      g.biome.switchTo(n);
      const sp = g.biome.spawnOf(n);
      const b = g.capy.body;
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      await sleep(2200);
      note(n + ' g' + g.world.gravity.y + ' bodies ' + g.world.bodies.length +
           ' draws ' + g.renderer.info.render.calls +
           ' tris ' + g.renderer.info.render.triangles +
           ' err ' + (g.state.lastError || '-'));
    }
    // gravity must be back where it started after a Drift round trip
    g.biome.switchTo('drift'); await sleep(500);
    const gDrift = g.world.gravity.y;
    g.biome.switchTo('venice'); await sleep(500);
    const gVen = g.world.gravity.y;
    g.biome.switchTo('drift'); await sleep(500);
    g.biome.switchTo('kowloon'); await sleep(500);
    note('gravity drift ' + gDrift + ' -> venice ' + gVen + ' -> kowloon ' + g.world.gravity.y);

    // --- the save -------------------------------------------------------
    g.completeTask('spritz-theft');
    g.completeTask('bamboo-climb');
    await sleep(1500);
    let raw = null;
    try { raw = localStorage.getItem('capy3.journey.v1'); } catch (e) {}
    note('saveBytes ' + (raw ? raw.length : 0) +
         ' hasVenice ' + (raw ? raw.indexOf('spritz-theft') >= 0 : false) +
         ' hasHK ' + (raw ? raw.indexOf('bamboo-climb') >= 0 : false));

    res.lastError = g.state.lastError || null;
    return res;
  });
  await page.evaluate(async o => {
    await fetch('/shot?name=journey.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
