async page => {
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
    const CH = [];
    for (let i = 0; i < 11; i++) CH.push(i + 1);
    // unlock everything so the board offers every line
    for (let n = 1; n <= 11; n++) g.completeTask('to-' + ['', '', 'pasto', 'quay', 'kyoto', 'cali',
      'rio', 'iceland', 'sahara', 'drift', 'venice', 'kowloon'][n] || '', true);

    // open the board and count the rows
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Tab', bubbles: true }));
    await sleep(400);
    const rows = document.querySelectorAll('.capyui-jrrow');
    note('boardRows ' + rows.length);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }));
    await sleep(300);

    // --- a soak through every biome, watching for a throw ---------------
    const names = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland',
                   'sahara', 'drift', 'venice', 'kowloon'];
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
