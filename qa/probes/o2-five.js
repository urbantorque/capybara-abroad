async page => {
  // THE TIER-FIVE BRANCH OF THE LEAF, which is the one line in this batch that
  // no other test reaches: the record board's tier-5 wording was measured in
  // O1, the leaf's was not, and it is a different ternary in a different file.
  await page.reload();
  await page.waitForTimeout(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2000);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
    const rec0 = () => {
      const f = g.palAudit().found.filter(x => x.b === 'venice')[0];
      return (g.locals || []).filter(l => l.biome === 'venice' &&
        Math.abs(l.x - f.x) < 0.2 && Math.abs(l.z - f.z) < 0.2)[0];
    };
    for (let v = 0; v < 6; v++) {
      g.biome.switchTo('venice'); tick(40);
      const rec = rec0();
      g.capy.body.position.set(rec.x + 2.3, g.venice.terrainHeight(rec.x + 2.3, rec.z + 0.4) + 0.35, rec.z + 0.4);
      g.capy.body.velocity.set(0, 0, 0);
      tick(60 * 55);
      g.biome.switchTo('kyoto'); tick(60 * 12);
    }
    return { tier: g.palDebug().tiers[10] || 0, best: g.palDebug().best,
             chairOut: !!g.noticed('chair-out') };
  });
  out.leaf = await page.evaluate(() => {
    const g = window.__capy;
    g.hud.ledger();
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
    return [...document.querySelectorAll('.capyui-lednoto')].map(e => e.textContent)
      .filter(t => t.indexOf('regular') >= 0);
  });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await page.evaluate((o) => fetch('/shot?name=o2-five.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
