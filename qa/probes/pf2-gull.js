async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5500);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('quay');
  });
  await page.waitForTimeout(2500);
  // stand on the apron and do nothing at all
  await page.evaluate(() => {
    const g = window.__capy;
    g.capy.body.position.set(0, 1.2, 30);
    g.capy.body.velocity.set(0, 0, 0);
  });
  const rows = [];
  for (let i = 0; i < 14; i++) {
    await page.waitForTimeout(1000);
    const s = await page.evaluate(() => {
      const g = window.__capy, p = g.capy.position;
      if ((p.x * p.x + (p.z - 30) * (p.z - 30)) > 4) {
        g.capy.body.position.set(0, 1.2, 30); g.capy.body.velocity.set(0, 0, 0);
      }
      const ca = g.hud.calmAudit();
      const c = (ca.critters || [])[0] || {};
      return { s: 0, loaf: +(g.capy.loaf || 0).toFixed(2), calm: +(ca.calm || 0).toFixed(2),
               bold: c.bold, appr: +(c.appr || 0).toFixed(3), near: +(c.near || 0).toFixed(2) };
    });
    s.s = i + 1;
    rows.push(s);
  }
  await page.evaluate(o => fetch('/shot?name=pf2-gull.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), rows);
}
