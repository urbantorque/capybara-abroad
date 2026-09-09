async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2000);
  const out = {};
  // Earn five tiers in Venice the honest way, watching for the gift and for
  // what the favour does to the wariness the gondolier writes.
  out.run = await page.evaluate(async () => {
    const g = window.__capy;
    const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
    const legs = [];
    const gifts = [];
    g.events.on('pal:gift', (e) => gifts.push({ tier: g.palDebug().tier, kind: e && e.kind }));
    const rec0 = () => (g.locals || []).filter(l => l.biome === 'venice' &&
      l.lines && String(l.lines[0]).indexOf('Gondola, gondola') >= 0)[0];
    for (let v = 0; v < 6; v++) {
      g.biome.switchTo('venice');
      tick(40);
      const rec = rec0();
      if (!rec.anchor.__w) {
        const real = rec.anchor.speak;
        const said = [];
        rec.anchor.speak = function (t) { said.push(t); return real.call(this, t); };
        rec.anchor.__w = said;
      } else rec.anchor.__w.length = 0;
      const api = g.venice;
      const px = rec.x + 2.4, pz = rec.z;
      g.capy.body.position.set(px, api.terrainHeight(px, pz) + 0.35, pz);
      g.capy.body.velocity.set(0, 0, 0);
      const before = (g.physics.count ? g.physics.count() : -1);
      tick(60 * 60);
      // WHAT THE FAVOUR IS WORTH, measured on the person rather than assumed:
      // clear their wariness, bang something at their feet, read what stuck.
      rec.wary = 0;
      const cp = g.capy.position;
      g.events.emit('prop:impact', { position: { x: rec.x + 0.6, y: rec.y, z: rec.z + 0.6 },
                                     speed: 9.0 });
      tick(2);
      const waryAfterBang = +(rec.wary || 0).toFixed(3);
      legs.push({ v: v + 1, tier: g.palDebug().tier, waryAfterBang,
                  soft: g.palAudit().soft, giftIn: g.palAudit().giftIn,
                  said: rec.anchor.__w.slice() });
      g.biome.switchTo('kyoto'); tick(60 * 20);
    }
    return { legs, gifts, dbg: g.palDebug(), audit: g.palAudit() };
  });
  // ...and the three finds, and the leaf line
  out.finds = await page.evaluate(async () => {
    const g = window.__capy;
    const ids = ['known-here', 'chair-out', 'five-places'];
    const r = {};
    for (const id of ids) r[id] = !!g.noticed(id);
    return r;
  });
  await page.evaluate((o) => fetch('/shot?name=o2-buys.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
