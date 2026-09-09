async page => {
  // CLEAR ONCE, NEVER AS AN INIT SCRIPT. `page.addInitScript` fires on EVERY
  // navigation, so a probe that installs it and then reloads to check something
  // SURVIVED a reload wipes the thing it is testing and blames the game. This
  // one reloads on purpose halfway through; the trap is in the harness memory
  // and it still cost a run.
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(3000);

  const out = {};

  // A synthetic attempt: drive `recordLive` by hand on a real record id while
  // walking the animal in a circle, so the trace is a real trace of a real
  // position without needing to play the Uji run twice.
  const RUN = `(async (opts) => {
    const g = window.__capy;
    const id = opts.id, secs = opts.secs, r = opts.r, better = opts.better;
    const b = g.capy.body;
    b.position.set(0, 1.2, 40); b.velocity.setZero();
    for (let i = 0; i < 30; i++) g.tick(1 / 60, false);
    const n = Math.round(secs * 60);
    let mid = null;
    for (let i = 0; i < n; i++) {
      const a = (i / 60) * 0.9;
      b.position.set(Math.cos(a) * r, 1.2, 40 + Math.sin(a) * r);
      b.previousPosition.copy(b.position);
      b.interpolatedPosition.copy(b.position);
      b.velocity.setZero();
      g.recordLive(id, better === 'lower' ? i / 60 : i / 60);
      g.tick(1 / 60, false);
      // HALFWAY, not at the end: at the end the ghost of an equal-length run
      // has already crossed its own finish and is fading, so a snapshot there
      // reads on:false for a ghost that was on screen for eight seconds.
      if (i === (n >> 1)) mid = g.hud.ghostAudit();
    }
    const snap = mid || g.hud.ghostAudit();
    g.record(id, opts.value);
    g.recordEnd(id);
    for (let i = 0; i < 20; i++) g.tick(1 / 60, false);
    return { during: snap, after: g.hud.ghostAudit() };
  })`;

  // ---- run one: nothing stored, so nothing to race ------------------------
  out.run1 = await page.evaluate(
    RUN + '({id:"uji-run",secs:9,r:14,better:"lower",value:40})');

  // ---- run two: the first run is the ghost --------------------------------
  out.run2 = await page.evaluate(
    RUN + '({id:"uji-run",secs:9,r:14,better:"lower",value:30})');

  // ---- and a sit is not a run ---------------------------------------------
  out.sit = await page.evaluate(`(async () => {
    const g = window.__capy;
    const b = g.capy.body;
    b.position.set(0, 1.2, 40); b.velocity.setZero();
    for (let i = 0; i < 60 * 9; i++) {
      b.position.set(0, 1.2, 40);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      g.recordLive('hot-spring', i / 60);
      g.tick(1 / 60, false);
    }
    const m = g.hud.ghostAudit().metres;
    g.record('hot-spring', 30);
    g.recordEnd('hot-spring');
    return { metres: m, kept: Object.keys(g.hud.ghostAudit().runs) };
  })()`);

  // ---- it survives a reload ----------------------------------------------
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2500);
  out.afterReload = await page.evaluate(() => window.__capy.hud.ghostAudit());

  // ---- and a border takes it off the screen -------------------------------
  out.border = await page.evaluate(async () => {
    const g = window.__capy;
    const b = g.capy.body;
    b.position.set(0, 1.2, 40); b.velocity.setZero();
    for (let i = 0; i < 60 * 4; i++) {
      const a = (i / 60) * 0.9;
      b.position.set(Math.cos(a) * 14, 1.2, 40 + Math.sin(a) * 14);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      g.recordLive('uji-run', i / 60);
      g.tick(1 / 60, false);
    }
    const on = g.hud.ghostAudit().on;
    g.biome.switchTo('venice');
    for (let i = 0; i < 10; i++) g.tick(1 / 60, false);
    return { onBefore: on, onAfter: g.hud.ghostAudit().on, id: g.hud.ghostAudit().id };
  });

  await page.evaluate(async (o) => {
    await fetch('/shot?name=v37-ghost.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);
}
