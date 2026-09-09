async page => {
  // CAN A PLAYER ACTUALLY BEFRIEND ALL SEVENTEEN? A tier is `fam` crossing
  // npcFAM_HEAT, `fam` only rises while THE CALM is running, and the calm does
  // not run while the animal is swimming, carried, in the air or otherwise on
  // capyBusy. A regular standing on a yacht deck or across a surf line is a
  // regular nobody can sit with, and nothing in the game would say so.
  //
  // The animal is put down at the person's OWN height and not at the terrain's
  // — the first cut of this probe used terrainHeight and measured fam 0 in
  // Monaco and Manly, which is a capybara treading water beside a boat.
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2000);
  const list = ['quay', 'kyoto', 'cali', 'rio', 'iceland', 'sahara', 'drift', 'venice',
                'kowloon', 'palawan', 'goreme', 'manly', 'pantanal', 'cave', 'antarctic',
                'monaco', 'hanoi'];
  const rows = [];
  for (const nm of list) {
    rows.push(await page.evaluate(async (nm) => {
      const g = window.__capy;
      const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
      g.biome.switchTo(nm);
      tick(90);
      if (g.biome.current !== nm) return { biome: nm, err: 'did not switch' };
      const f = g.palAudit().found.filter(x => x.b === nm)[0];
      if (!f) return { biome: nm, err: 'no regular' };
      const rec = (g.locals || []).filter(l => l.biome === nm &&
        Math.abs(l.x - f.x) < 0.2 && Math.abs(l.z - f.z) < 0.2)[0];
      const said = [];
      const real = rec.anchor.speak;
      rec.anchor.speak = function (t) { said.push(t); return real.call(this, t); };
      // beside them, at their height, facing whatever
      const px = rec.x + 2.2, pz = rec.z + 0.4;
      g.capy.body.position.set(px, rec.y + 0.5, pz);
      g.capy.body.velocity.set(0, 0, 0);
      let cross = -1, calmMax = 0, swim = 0, gnd = 0, n = 0;
      for (let i = 0; i < 60 * 150; i++) {
        g.tick(1 / 60, false);
        n++;
        if (g.capy.swimming) swim++;
        if (g.capy.grounded) gnd++;
        const c = typeof g.calmNow === 'number' ? g.calmNow : 0;
        if (c > calmMax) calmMax = c;
        if (cross < 0 && (rec.fam || 0) > 0.45) cross = +(i / 60).toFixed(1);
      }
      const p = g.capy.position;
      return { biome: nm, who: f.who, cross, tier: g.palDebug().tier,
               fam: +(rec.fam || 0).toFixed(2), near: rec.near,
               calmMax: +calmMax.toFixed(2), swim: +(swim / n).toFixed(2),
               gnd: +(gnd / n).toFixed(2),
               drift: +Math.hypot(p.x - rec.x, p.z - rec.z).toFixed(1),
               dy: +(p.y - rec.y).toFixed(2), said };
    }, nm));
  }
  await page.evaluate((o) => fetch('/shot?name=o1-all.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), rows);
}
