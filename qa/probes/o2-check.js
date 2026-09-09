async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2000);
  const out = {};
  // A. THE TIER MUST NOT FOLLOW YOU. Tier 5 in Venice, then walk into Kyoto,
  //    where nobody has met you: `soft` must be 1 and no gift may appear.
  out.leak = await page.evaluate(async () => {
    const g = window.__capy;
    const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
    const rec0 = () => (g.locals || []).filter(l => l.biome === 'venice' &&
      l.lines && String(l.lines[0]).indexOf('Gondola, gondola') >= 0)[0];
    for (let v = 0; v < 5; v++) {
      g.biome.switchTo('venice'); tick(40);
      const rec = rec0();
      const px = rec.x + 2.4, pz = rec.z;
      g.capy.body.position.set(px, g.venice.terrainHeight(px, pz) + 0.35, pz);
      g.capy.body.velocity.set(0, 0, 0);
      tick(60 * 45);
      g.biome.switchTo('kyoto'); tick(60 * 12);
    }
    const inVenice = { tier: g.palDebug().tiers[10] || 0 };
    // now stand next to Kyoto's regular, who has never met this animal
    g.biome.switchTo('kyoto'); tick(60);
    const f = g.palAudit().found.filter(x => x.b === 'kyoto')[0];
    const kr = (g.locals || []).filter(l => l.biome === 'kyoto' &&
      Math.abs(l.x - f.x) < 0.2 && Math.abs(l.z - f.z) < 0.2)[0];
    g.capy.body.position.set(kr.x + 2.4, kr.y + 0.5, kr.z);
    g.capy.body.velocity.set(0, 0, 0);
    const gifts = [];
    g.events.on('pal:gift', (e) => gifts.push(e && e.kind));
    tick(60 * 20);
    kr.wary = 0;
    g.events.emit('prop:impact', { position: { x: kr.x + 0.6, y: kr.y, z: kr.z + 0.6 }, speed: 9.0 });
    tick(2);
    return { inVenice, kyotoTier: g.palAudit().tier, kyotoSoft: g.palAudit().soft,
             kyotoWary: +(kr.wary || 0).toFixed(3), giftsInKyoto: gifts };
  });
  // B. THE GIFT IN THE WORLD. Earn tier 3 in the Quay, wait for the ticket,
  //    then look at where it landed and whether it can be picked up.
  out.gift = await page.evaluate(async () => {
    const g = window.__capy;
    const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
    const rec0 = () => {
      const f = g.palAudit().found.filter(x => x.b === 'quay')[0];
      return (g.locals || []).filter(l => l.biome === 'quay' &&
        Math.abs(l.x - f.x) < 0.2 && Math.abs(l.z - f.z) < 0.2)[0];
    };
    let said = null;
    for (let v = 0; v < 3; v++) {
      g.biome.switchTo('quay'); tick(40);
      const rec = rec0();
      if (!rec.anchor.__w) {
        const real = rec.anchor.speak; const arr = [];
        rec.anchor.speak = function (t) { arr.push(t); return real.call(this, t); };
        rec.anchor.__w = arr;
      }
      const px = rec.x + 2.3, pz = rec.z + 0.3;
      g.capy.body.position.set(px, g.quay.terrainHeight(px, pz) + 0.35, pz);
      g.capy.body.velocity.set(0, 0, 0);
      tick(60 * 50);
      if (v < 2) { g.biome.switchTo('kyoto'); tick(60 * 12); }
    }
    const rec = rec0();
    // NO PROP ENUMERATION EXISTS: neither physics.all nor physics.list is real
    // (three older probes fall back past both), so the gift is caught at the
    // door instead — the one call that makes it.
    let got = null;
    const realSpawn = g.physics.spawnProp;
    g.physics.spawnProp = function (t, x, z, y, yaw) {
      const p = realSpawn.call(this, t, x, z, y, yaw);
      if (t === 'ticket' && p) got = p;
      return p;
    };
    for (let i = 0; i < 60 * 150 && !got; i++) g.tick(1 / 60, false);
    if (got) for (let i = 0; i < 60 * 6; i++) g.tick(1 / 60, false);
    const cp = g.capy.position;
    said = rec.anchor.__w.filter(t => t.indexOf('Ferry ticket') >= 0);
    return got ? { found: true, kind: got.type, name: got.name,
                   grabbable: !!got.grabbable, owner: !!got.owner,
                   dPerson: +Math.hypot(got.body.position.x - rec.x, got.body.position.z - rec.z).toFixed(2),
                   dCapy: +Math.hypot(got.body.position.x - cp.x, got.body.position.z - cp.z).toFixed(2),
                   aboveGround: +(got.body.position.y - g.quay.terrainHeight(got.body.position.x, got.body.position.z)).toFixed(2),
                   said }
                : { found: false, tier: g.palDebug().tier, said };
  });
  await page.evaluate((o) => fetch('/shot?name=o2-check.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
