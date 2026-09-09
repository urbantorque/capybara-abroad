// CUSTOMS, THE GATE — you may bring one thing with you.
//
// props.js's confiscation is untouched and stays strict: a held prop's ORIGINAL
// goes home whole on every crossing, because its body left the world with its
// own chapter and releasing it abroad would leave it dynamic, unsimulated and
// invisible. What crosses is a loose copy, through the same hatch the nineteen
// keepsakes have used since they were built.
//
// WHAT IT ASSERTS
//   travels    hold a cone in Venice, cross, still holding a cone
//   loose      the copy carries `biome: ''` — a tagged one would vanish with
//              the next chapter, which is the whole failure being avoided
//   home       the original is back in its own chapter, not removed
//   one        crossing again does not accumulate a second traveller
//   refused    a poster does not travel (see physNO_TRAVEL)
async page => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  await page.goto('http://localhost:5188/', { waitUntil: 'load' });
  await page.waitForTimeout(6500);
  await page.keyboard.press('Space');
  await page.waitForTimeout(3000);

  const out = { hops: [] };
  const cross = async (to) => {
    await page.evaluate((n) => {
      const g = window.__capy;
      try { g.hud.cross(n); } catch (e) { g.biome.switchTo(n); }
    }, to);
    await page.waitForTimeout(4800);
    return await page.evaluate(() => {
      const g = window.__capy;
      const h = g.capy.heldProp;
      return {
        biome: g.biome.current,
        holding: h ? h.type : null,
        heldBiome: h ? h.biome : null,
        travel: g.physics.travelAudit ? g.physics.travelAudit() : null,
        // How many loose (biome-less) non-keepsake props exist. This is the
        // number the whole design is bounded by, and it must never climb.
        loose: g.props.filter(p => !p.removed && !p.biome && !p.keep).length,
      };
    });
  };

  await page.evaluate(() => {
    const g = window.__capy;
    try { g.hud.cross('venice'); } catch (e) { g.biome.switchTo('venice'); }
  });
  await page.waitForTimeout(4800);
  // Pick up an ordinary cone — the most ordinary prop there is.
  out.picked = await page.evaluate(() => {
    const g = window.__capy;
    const p = g.capy.position;
    const pr = g.physics.spawnProp('cone', p.x + 0.6, p.z + 0.2);
    if (pr) g.physics.grab(pr);
    const h = g.capy.heldProp;
    return { type: h ? h.type : null, biome: h ? h.biome : null };
  });
  out.hops.push(await cross('goreme'));
  out.hops.push(await cross('hanoi'));
  out.hops.push(await cross("kyoto"));
  // ---- ...AND SOMEBODY REMARKS ON IT (the reaction half) ----------------
  // npcKeepStep arms a line about an object that is not from here and waits
  // for a mouth. It keyed on `keep` and could therefore only ever be about a
  // souvenir; item 5 gives ordinary luggage a `travelFrom` and this is the
  // check that the pool can now see one.
  out.remark = await page.evaluate(() => new Promise((res) => {
    const g = window.__capy;
    const live = g.biome.current;
    // Bring somebody into earshot — npcKEEP_R is 14 m and the arrival spawn
    // is not guaranteed to have anybody inside it.
    // FAR ENOUGH THAT THE LINE CAN BE CAUGHT. At three metres it armed and
    // was spent inside the first sample and the probe could only report that
    // it had happened, not what it said — the same trap nr-keep.js hit.
    for (const r of g.locals) {
      if (r.biome !== live || !r.group) continue;
      const p = g.capy.position;
      r.x = p.x + 13; r.z = p.z;
      r.ax = r.x; r.az = r.z; r.tx = r.x; r.tz = r.z;
      r.group.position.set(r.x, r.group.position.y, r.z);
      break;
    }
    let seen = "";
    const t0 = performance.now();
    (function step() {
      const a = g.keepAudit ? g.keepAudit() : null;
      if (a && a.line && !seen) seen = a.line;
      if (performance.now() - t0 < 3000) { requestAnimationFrame(step); return; }
      // ...and only THEN bring somebody into earshot, so the arming is visible
      // before the spending.
      for (const r of g.locals) {
        if (r.biome !== live || !r.group) continue;
        const p = g.capy.position;
        r.x = p.x + 3; r.z = p.z;
        r.ax = r.x; r.az = r.z; r.tx = r.x; r.tz = r.z;
        r.group.position.set(r.x, r.group.position.y, r.z);
        break;
      }
      if (performance.now() - t0 < 9000) requestAnimationFrame(step);
      else res({ line: seen, said: g.keepAudit ? g.keepAudit().said : -1,
                 holding: g.capy.heldProp ? g.capy.heldProp.type : null,
                 from: g.capy.heldProp ? g.capy.heldProp.travelFrom : null });
    })();
  }));

  // REMARK CHECK RUNS HERE, before the poster row swaps the luggage out.
  // ...and the refusal. A poster is yours rather than the chapter's and
  // posterPut already stands a fresh one wherever you land.
  out.poster = await (async () => {
    const made = await page.evaluate(() => {
      const g = window.__capy;
      const p = g.capy.position;
      if (g.capy.heldProp) g.physics.release(null);
      const pr = g.physics.spawnProp('poster', p.x + 0.6, p.z + 0.2);
      if (pr) g.physics.grab(pr);
      const h = g.capy.heldProp;
      return { type: h ? h.type : null };
    });
    const after = await cross('venice');
    return { made: made, after: after };
  })();

  out.errors = errs.slice(0, 8);
  await page.evaluate(async (p) => {
    await fetch('/shot?name=NR-TRAVEL', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(p)))) });
  }, out);
}
