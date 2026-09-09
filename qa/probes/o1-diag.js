async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2000);
  const out = {};
  // A. WHY DOES AN ARMED LINE NOT LAND? Log the gate on every try.
  out.gate = await page.evaluate(async () => {
    const g = window.__capy;
    const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
    g.biome.switchTo('venice');
    tick(60);
    const rec = (g.locals || []).filter(l => l.biome === 'venice' &&
      l.lines && String(l.lines[0]).indexOf('Gondola, gondola') >= 0)[0];
    const api = g.venice;
    const px = rec.x + 2.4, pz = rec.z;
    g.capy.body.position.set(px, api.terrainHeight(px, pz) + 0.35, pz);
    g.capy.body.velocity.set(0, 0, 0);
    tick(120);
    g.palArm(2);
    const rows = [];
    for (let i = 0; i < 60 * 40; i++) {
      tick(1);
      if (i % 20 === 0) {
        const p = g.capy.position;
        rows.push({ t: +(i / 60).toFixed(1), armed: g.palAudit().line.slice(0, 14),
          talkCd: +(rec.talkCd || 0).toFixed(1), own: !!rec.own,
          d: +Math.hypot(rec.x - p.x, rec.z - p.z).toFixed(1) });
      }
    }
    return rows.filter((x, i) => i % 3 === 0);
  });
  // B. WHAT COMES BACK FROM THE FILE. Write a journey, reload, look at all of it.
  out.before = await page.evaluate(() => {
    const g = window.__capy;
    try {
      const f = JSON.parse(localStorage.getItem('capy3.journey.v1'));
      return { keys: Object.keys(f), pal: f.pal, tasks: (f.tasks || []).length,
               seen: (f.seen || []).length, pho: f.pho, dbg: g.palDebug() };
    } catch (e) { return { err: String(e) }; }
  });
  await page.reload();
  await page.waitForTimeout(5200);
  out.title = await page.evaluate(() => {
    try {
      const f = JSON.parse(localStorage.getItem('capy3.journey.v1'));
      return { onFile: f.pal, tasks: (f.tasks || []).length };
    } catch (e) { return { err: String(e) }; }
  });
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2500);
  out.after = await page.evaluate(() => {
    const g = window.__capy;
    return { dbg: g.palDebug(), started: g.state.started,
             seenN: (g.hud && g.hud.journeyAudit) ? g.hud.journeyAudit() : null,
             onFile: (function () { try { return JSON.parse(localStorage.getItem('capy3.journey.v1')).pal; } catch (e) { return 'gone'; } })() };
  });
  await page.evaluate((o) => fetch('/shot?name=o1-diag.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
