async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2000);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
    g.biome.switchTo('manly');
    tick(90);
    const f = g.palAudit().found.filter(x => x.b === 'manly')[0];
    const rec = (g.locals || []).filter(l => l.biome === 'manly' &&
      Math.abs(l.x - f.x) < 0.2 && Math.abs(l.z - f.z) < 0.2)[0];
    g.capy.body.position.set(rec.x + 2.0, rec.y + 0.5, rec.z);
    g.capy.body.velocity.set(0, 0, 0);
    const rows = [];
    for (let i = 0; i < 60 * 60; i++) {
      g.tick(1 / 60, false);
      if (i % 300 === 0) {
        const p = g.capy.position;
        rows.push({ t: +(i / 60).toFixed(1), fam: +(rec.fam || 0).toFixed(3),
          wary: +(rec.wary || 0).toFixed(2), rest: +(g.capy.restT || 0).toFixed(1),
          still: +(g.capy.stillT || 0).toFixed(1), loaf: +(g.capy.loaf || 0).toFixed(2),
          d: +Math.hypot(p.x - rec.x, p.z - rec.z).toFixed(2),
          y: +p.y.toFixed(2), recY: +rec.y.toFixed(2),
          swim: !!g.capy.swimming, gnd: !!g.capy.grounded,
          heat: +g.placeHeat(rec.x, rec.z).toFixed(2), sat: +(rec.sat || 0).toFixed(1),
          own: !!rec.own, gd: !!rec.gd });
      }
    }
    return { near: rec.near, rows };
  });
  await page.evaluate((o) => fetch('/shot?name=o1-manly.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
