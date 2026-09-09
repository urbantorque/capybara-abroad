async page => {
  // NO addInitScript HERE. It fires on every navigation (README trap 2) and
  // this probe's whole second half is a reload that must find the file it
  // just wrote. Cleared once, by hand, before the first run.
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2000);
  const out = { legs: [] };
  // FIVE VISITS to Venice. Each one: arrive, stand beside the gondolier, do
  // nothing at all for seventy seconds. Between them a REAL away leg of half
  // a minute in Kyoto — thirty seconds of world time and a second biome:enter
  // — because "one tier per visit" is only true if a visit is a visit.
  for (let v = 0; v < 11; v++) {
    out.legs.push(await page.evaluate(async (v) => {
      const g = window.__capy;
      const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
      g.biome.switchTo(v % 2 === 0 ? 'venice' : 'kyoto');
      tick(40);
      if (v % 2 === 1) { tick(60 * 30); return { v, biome: g.biome.current, skip: 1 }; }
      const rec = (g.locals || []).filter(l => l.biome === 'venice' &&
        l.lines && String(l.lines[0]).indexOf('Gondola, gondola') >= 0)[0];
      // WHAT THE REGULAR ACTUALLY SAID. `anchor.lastLine` is never written by
      // sayBubble — it is the field the bubble reader wants to exist — so a
      // probe that reads it measures silence in a chapter that is talking.
      // The mouth itself is wrapped instead.
      const said = [];
      if (!rec.anchor.__wrapped) {
        const real = rec.anchor.speak;
        rec.anchor.speak = function (t) { said.push(t); return real.call(this, t); };
        rec.anchor.__wrapped = said;
      } else { rec.anchor.__wrapped.length = 0; }
      const heard = rec.anchor.__wrapped;
      const api = g.venice;
      const px = rec.x + 2.4, pz = rec.z;
      g.capy.body.position.set(px, api.terrainHeight(px, pz) + 0.35, pz);
      g.capy.body.velocity.set(0, 0, 0);
      const famIn = +(rec.fam || 0).toFixed(3);
      const armedOnArrival = g.palAudit().line;
      let cross = -1;
      for (let i = 0; i < 60 * 70; i++) {
        g.tick(1 / 60, false);
        if (cross < 0 && (rec.fam || 0) > 0.45) cross = +(i / 60).toFixed(1);
      }
      return { v, visit: v / 2 + 1, biome: g.biome.current, famIn, armedOnArrival,
               cross, tier: g.palDebug().tier, fam: +(rec.fam || 0).toFixed(2),
               said: heard.slice(), stillArmed: g.palAudit().line };
    }, v));
  }
  out.saved = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('capy3.journey.v1')).pal; }
    catch (e) { return 'none'; }
  });
  // ...AND THE ONE THING THE ITEM IS ABOUT: it is still true tomorrow.
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2500);
  out.after = await page.evaluate(async () => {
    const g = window.__capy;
    g.biome.switchTo('venice');
    const rec0 = () => (g.locals || []).filter(l => l.biome === 'venice' &&
      l.lines && String(l.lines[0]).indexOf('Gondola, gondola') >= 0)[0];
    for (let i = 0; i < 20; i++) g.tick(1 / 60, false);
    const rec = rec0();
    const said = [];
    const real = rec.anchor.speak;
    rec.anchor.speak = function (t) { said.push(t); return real.call(this, t); };
    // walk up to them the way a player would: put the animal in earshot and
    // let the armed line find them.
    const api = g.venice;
    const px = rec.x + 3.0, pz = rec.z;
    g.capy.body.position.set(px, api.terrainHeight(px, pz) + 0.35, pz);
    for (let i = 0; i < 60 * 20; i++) g.tick(1 / 60, false);
    return { tiers: g.palDebug().tiers, tier: g.palDebug().tier,
             said, where: g.biome.current, err: g.state.lastError || null };
  });
  await page.evaluate((o) => fetch('/shot?name=o1-earn.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
