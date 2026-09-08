async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(4800);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  await page.evaluate(async () => {
    const g = window.__capy;
    g.biome.switchTo('sydney');
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false);
    g.capy.body.position.set(6, 1.0, 34);
    g.capy.body.velocity.set(0, 0, 0);
    for (let i = 0; i < 300; i++) g.tick(1 / 60, false);
  });
  // A SINGLE page.evaluate LONGER THAN ~20-30 s DIES with "Execution context was
  // destroyed" (harness trap 2), and twenty-five minutes of ticks is well past
  // that. One evaluate per four minutes, and the state lives in the page.
  const rows = [];
  for (let chunk = 0; chunk < 7; chunk++) {
    const r = await page.evaluate(async () => {
      const g = window.__capy;
      for (let i = 0; i < 60 * 240; i++) g.tick(1 / 60, false);
      const d = g.napDebug();
      return { slept: d.slept, shots: d.shots, album: d.album, tagged: d.tagged };
    });
    rows.push(r);
  }
  const out = await page.evaluate(() => {
    const g = window.__capy;
    const a = g.hud.albumAudit();
    return { audit: a, nap: g.napDebug(), err: g.state.lastError || null };
  });
  await page.evaluate((o) => fetch('/shot?name=n5-cap.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), { rows, out });
}
