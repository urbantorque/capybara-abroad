async page => {
  // ---- CLEARING THE SAVE TAKES TWO RELOADS, AND THE FIRST CUT OF THIS PROBE
  // ---- MEASURED THE PREVIOUS RUN'S JOURNEY.
  // `localStorage.clear()` followed by `page.reload()` does NOT leave an empty
  // file: the reload fires `pagehide`, the pagehide flush is unconditional (it
  // has to be — the clock is always stale), and it writes the still-live
  // in-memory journey straight back over the clear. Reload first, clear on the
  // fresh page, reload again: the second flush runs on a page that has never
  // started a game, and saveWrite refuses to manufacture a file at the title
  // card. Symptom without this: tiers in chapters the probe never visited, and
  // five tiers out of three visits.
  await page.reload();
  await page.waitForTimeout(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2000);
  const out = {};
  out.start = await page.evaluate(() => window.__capy.palDebug().tiers);
  // A. FIVE PLACES AT TIER 3 — the third find, and the only one that asks for
  //    more than one chapter.
  out.five = await page.evaluate(async () => {
    const g = window.__capy;
    const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
    const where = ['goreme', 'venice', 'quay', 'kyoto', 'hanoi'];
    const legs = [];
    for (let v = 0; v < 4; v++) {
      for (const nm of where) {
        g.biome.switchTo(nm); tick(40);
        const f = g.palAudit().found.filter(x => x.b === nm)[0];
        const rec = (g.locals || []).filter(l => l.biome === nm &&
          Math.abs(l.x - f.x) < 0.2 && Math.abs(l.z - f.z) < 0.2)[0];
        g.capy.body.position.set(rec.x + 2.3, rec.y + 0.5, rec.z + 0.3);
        g.capy.body.velocity.set(0, 0, 0);
        tick(60 * 50);
      }
      legs.push({ round: v + 1, tiers: JSON.parse(JSON.stringify(g.palDebug().tiers)) });
    }
    return { legs, tiers: g.palDebug().tiers, atThree: g.palDebug().atThree,
             best: g.palDebug().best,
             finds: { knownHere: !!g.noticed('known-here'),
                      chairOut: !!g.noticed('chair-out'),
                      fivePlaces: !!g.noticed('five-places') } };
  });
  // B. THE LEDGER LEAF. `hud.ledger()` is the door; J, L and K are not.
  out.leaf = await page.evaluate(async () => {
    const g = window.__capy;
    try { g.hud.ledger(); } catch (e) { return { err: String(e) }; }
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
    const rows = [...document.querySelectorAll('.capyui-lednoto')].map(e => e.textContent);
    return { n: rows.length, regular: rows.filter(t => t.indexOf('regular') >= 0) };
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'qa/O2-leaf.png' });
  // hud.ledger() OPENS; it does not toggle. Escape is the way back out, and it
  // has to be a real key press: the first cut called hud.ledger() again, left
  // the card up and the game paused, and section C measured a chapter that was
  // never ticked.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  // C. THE GIFT, ON THE GROUND, IN FRONT OF THE PERSON WHO PUT IT THERE.
  await page.evaluate(async () => {
    const g = window.__capy;
    const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
    // THE LEDGER PAUSES THE GAME, and `paused` skips every module except
    // systems.js — so npc.js is not ticked and nothing about a regular happens
    // while it is open. Closed, and asserted closed, before section C runs.
    window.__pausedInC = !!g.state.paused;
    g.biome.switchTo('goreme'); tick(60);
    const f = g.palAudit().found.filter(x => x.b === 'goreme')[0];
    const rec = (g.locals || []).filter(l => l.biome === 'goreme' &&
      Math.abs(l.x - f.x) < 0.2 && Math.abs(l.z - f.z) < 0.2)[0];
    g.capy.body.position.set(rec.x + 2.2, rec.y + 0.5, rec.z + 0.4);
    g.capy.body.velocity.set(0, 0, 0);
    rec.talkCd = 0;
    let put = false;
    const real = g.physics.spawnProp;
    g.physics.spawnProp = function (t, x, z, y, yaw) {
      const p = real.call(this, t, x, z, y, yaw);
      if (t === 'mug' && p) put = true;
      return p;
    };
    for (let i = 0; i < 60 * 130 && !put; i++) g.tick(1 / 60, false);
    tick(40);
    g.frameShot({ dist: 5.0, near: true, pitch: 0.34, raise: 0.06, hold: 16, w: 1 });
    let alive = true;
    const loop = () => { if (!alive) return; requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    window.__pinStop = () => { alive = false; };
    tick(130);
    window.__put = put;
  });
  await page.waitForTimeout(2400);
  await page.screenshot({ path: 'qa/O2-gift.png' });
  out.put = await page.evaluate(() => ({ put: window.__put, pausedInC: window.__pausedInC }));
  await page.evaluate(() => { if (window.__pinStop) window.__pinStop(); });
  await page.evaluate((o) => fetch('/shot?name=o2-shot.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
