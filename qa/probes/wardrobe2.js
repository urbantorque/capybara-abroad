async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5500);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2500);
  const ROWS = [
    { b: 'rio',       t: 'samba-parade', w: 'plumes' },
    { b: 'goreme',    t: 'sunrise',      w: 'flycap' },
    { b: 'manly',     t: 'all-the-way',  w: 'surfcap' },
    { b: 'palawan',   t: 'first-dive',   w: 'snorkel' },
    { b: 'antarctic', t: 'orca-ride',    w: 'parka' },
  ];
  const out = [];
  for (const r of ROWS) {
    await page.evaluate((q) => {
      const g = window.__capy;
      g.biome.switchTo(q.b);
      g.completeTask(q.t, true);
      const sp = g.biome.spawnOf(q.b);
      const bd = g.capy.body;
      bd.position.set(sp.x, sp.y + 0.4, sp.z);
      bd.velocity.set(0, 0, 0);
      bd.previousPosition.copy(bd.position); bd.interpolatedPosition.copy(bd.position);
    }, r);
    await page.waitForTimeout(2600);
    out.push(await page.evaluate(() => ({ worn: window.__capy.capy.worn,
      err: window.__capy.state.lastError || null })));
    for (const s of [{ n: 'X-' + r.w + '-3q', yaw: 2.25, pitch: -0.06 },
                     { n: 'X-' + r.w + '-face', yaw: 3.14, pitch: -0.10 }]) {
      await page.evaluate((q) => {
        window.__capy.frameShot({ yaw: q.yaw, dist: 2.1, pitch: q.pitch, raise: 0.30, hold: 3.4 });
      }, s);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'qa/' + s.n + '.png',
                              clip: { x: 515, y: 300, width: 260, height: 175 } });
      await page.waitForTimeout(2300);
    }
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=wardrobe2.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, out);
}
