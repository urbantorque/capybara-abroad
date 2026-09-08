async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(4800);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const o = { ladder: [], wake: [], onCarrier: null };
    const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
    g.biome.switchTo('sydney');
    tick(120);
    // A PIN IS RIGHT BESIDE AN ANIMAL AND WRONG BESIDE A PERSON (N2's trap),
    // and this measures the animal's own clock, so no pin: put it on open lawn
    // away from the cast, let it settle, and leave it entirely alone.
    g.capy.body.position.set(6, 1.0, 34);
    g.capy.body.velocity.set(0, 0, 0);
    tick(240);
    o.start = { grounded: g.capy.grounded, rest: +g.capy.restT.toFixed(1) };
    // ---- the four tiers, sampled once a second --------------------------
    for (let s = 0; s < 40; s++) {
      tick(60);
      o.ladder.push({ t: s + 1, rest: +g.capy.restT.toFixed(1),
                      loaf: +g.capy.loaf.toFixed(3), nap: +g.capy.nap.toFixed(3) });
    }
    o.asleep = +g.capy.nap.toFixed(3);
    // THE POSE, AS NUMBERS. "The head goes down" and "the ears go out" are not
    // measurements, and a still at playing distance cannot settle either.
    const pose = function () {
      const a = g.capy.animAudit();
      return { nap: +a.nap.toFixed(2), headX: +a.headX.toFixed(3),
               earZ: +a.earZ.toFixed(3), modelY: +a.modelY.toFixed(4),
               eyeOpen: +a.eyeOpen.toFixed(4), breath: +a.breath.toFixed(4) };
    };
    o.poseAsleep = pose();
    // ---- ...and a key wakes it ------------------------------------------
    // A KEY THAT DOES NOT MOVE THE ANIMAL is the case the wake channel exists
    // for: `capyBusy` cannot see a wheek, and `capyRestT` goes on running
    // through one. NOT `KeyJ` — the journal PAUSES the game, and `paused` skips
    // every module except systems.js, so capybara.js is not ticked at all and
    // the nap cannot change: measured `rest` frozen at 43.8 for five samples,
    // which reads as a wake that does nothing. Q is the wheek: a real key, a
    // real verb, and the game keeps running under it.
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', key: 'q', bubbles: true }));
    for (let s = 0; s < 8; s++) {
      tick(15);
      o.wake.push({ t: +((s + 1) * 0.25).toFixed(2), nap: +g.capy.nap.toFixed(3),
                    rest: +g.capy.restT.toFixed(1) });
      // AWAKE AND STILL SAT DOWN, at the one moment it is true: the nap is at
      // zero and it has not started creeping back. Sampled at the end and it
      // read 0.35, which is not a control, it is a third of the thing.
      if (s === 4) o.poseAwakeLoaf = pose();
    }
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyQ', key: 'q', bubbles: true }));
    tick(60);

    // ---- and it goes back to sleep on its own ---------------------------
    for (let s = 0; s < 12; s++) tick(60);
    o.backAsleep = +g.capy.nap.toFixed(3);
    // ---- IT MUST NOT SLEEP AT THE HELM ----------------------------------
    // The seven-ways memory says a carrier is where passengers are lost, and
    // falling asleep at the wheel of a ferry is a row somebody will try. The
    // loaf already refuses `atHelm`; this inherits it and the test is whether
    // that inheritance is real.
    // Reaching a real wheel needs a walk to it, and what changed is the GATE,
    // not the ferry — so the gate is what is tested. Nothing in Sydney writes
    // `atHelm`, so a write here sticks, and a nap that survives it is a nap
    // that would survive a ferry.
    o.beforeHelm = +g.capy.nap.toFixed(3);
    const helmTrace = [];
    for (let s = 0; s < 8; s++) {
      for (let i = 0; i < 30; i++) { g.capy.atHelm = true; g.tick(1 / 60, false); }
      helmTrace.push({ t: +((s + 1) * 0.5).toFixed(1), nap: +g.capy.nap.toFixed(3),
                       loaf: +g.capy.loaf.toFixed(3) });
    }
    g.capy.atHelm = false;
    o.onCarrier = helmTrace;
    o.lastError = g.state.lastError || null;
    return o;
  });
  await page.evaluate((o) => fetch('/shot?name=n4-nap.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
