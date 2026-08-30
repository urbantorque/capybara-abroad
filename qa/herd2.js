async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5500);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2500);
  const out = {};

  for (const biome of ['venice', 'goreme', 'kyoto', 'iceland']) {
    await page.evaluate((n) => { window.__capy.biome.switchTo(n); }, biome);
    await page.waitForTimeout(2800);
    out[biome] = await page.evaluate(() => {
      const g = window.__capy, c = g.capy;
      const down = k => window.dispatchEvent(new KeyboardEvent('keydown', { code: k, bubbles: true }));
      const up = k => window.dispatchEvent(new KeyboardEvent('keyup', { code: k, bubbles: true }));
      const T = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
      const wheek = () => { down('KeyQ'); T(5); up('KeyQ'); T(16); };
      const b = c.body;

      const d0 = g.herdDebug();
      if (!d0.kinds.length || !d0.kinds[0].first) return { none: true, dbg: d0 };
      const K = d0.kinds[0];

      // ---- SKILL OFF FIRST, before `gather` is anywhere near ticked --------
      const off = { done: g.taskDone('gather') };
      if (!off.done) {
        b.position.set(K.first.x + 1.6, K.first.y + 0.6, K.first.z + 1.6);
        b.velocity.set(0, 0, 0);
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
        T(40); wheek(); wheek(); wheek();
        off.following = g.herdCount();
      }
      g.completeTask('gather', true);
      T(10);

      // ---- WALK OUT OF EARSHOT AND LET THE MEMORY GO -----------------------
      // The counter bleeds over herdHEARD_T, so a tier can only be measured
      // from a clean animal. Stand 60 m off for twelve seconds first, or the
      // last chapter's wheeks are still in this one's arithmetic — which is
      // exactly how the first run measured a two-wheek cat joining on one.
      b.position.set(K.first.x + 60, K.first.y + 0.6, K.first.z + 60);
      b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      T(60 * 12);
      const clean = g.herdDebug().kinds[0];

      // ---- NOW COUNT THE WHEEKS -------------------------------------------
      b.position.set(K.first.x + 1.6, K.first.y + 0.6, K.first.z + 1.6);
      b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      T(40);
      const steps = [];
      let joinedAt = 0;
      for (let w = 1; w <= 4; w++) {
        wheek(); T(20);
        const d = g.herdDebug().kinds[0];
        steps.push({ w: w, following: d.led, looking: d.looking, heard: d.heard });
        if (!joinedAt && d.led > 0) joinedAt = w;
      }
      // where is everybody, for the heron diagnosis
      const capyP = c.position;
      return { kind: K.kind, obey: K.obey, n: K.n, off: off,
               cleanHeard: clean ? clean.heard : null,
               joinedOnWheek: joinedAt, steps: steps,
               animalAt: K.first,
               capyAt: [+capyP.x.toFixed(1), +capyP.y.toFixed(1), +capyP.z.toFixed(1)],
               nNow: g.herdDebug().kinds[0] ? g.herdDebug().kinds[0].n : null,
               err: g.state.lastError || null };
    });
  }

  await page.evaluate(async (o) => {
    await fetch('/shot?name=herd2.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
