async page => {
  const ids = await page.evaluate(async () => (await fetch('/qa/all-task-ids.json')).json());
  // fin: 1 — the lawn is still laid (staging is not gated on it), but the
  // closing beat is already spent, so the ledger will not open over the shot.
  await page.evaluate(o => {
    localStorage.clear();
    localStorage.setItem('capy3.journey.v1', JSON.stringify({
      v: 1, tasks: o.ids, seen: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17], recs: {},
      told: 1, ms: 3600000, chapms: {}, finds: [], foundAt: {}, biome: 'sydney', fin: 1
    }));
  }, { ids: ids });
  await page.reload();
  await page.evaluate(() => new Promise(r => setTimeout(r, 4500)));
  await page.keyboard.press('Digit1');
  await page.evaluate(() => new Promise(r => setTimeout(r, 3500)));
  // walk in from the south-west, which is the way you actually arrive from spawn
  await page.evaluate(() => {
    const g = window.__capy;
    g.capy.body.position.set(30, 1.0, 26);
    g.capy.body.velocity.set(0, 0, 0);
  });
  // let it settle and loaf, so the camera eases to its wide framing
  for (let i = 0; i < 12; i++) {
    await page.evaluate(() => new Promise(r => setTimeout(r, 1000)));
    await page.evaluate(() => {
      const g = window.__capy;
      const p = g.capy.position;
      const dx = p.x - 30, dz = p.z - 26;
      if (dx * dx + dz * dz > 4) { g.capy.body.position.set(30, 1.0, 26); g.capy.body.velocity.set(0, 0, 0); }
    });
  }
  const st = await page.evaluate(() => {
    const g = window.__capy;
    return { loaf: +(g.capy.loaf || 0).toFixed(2), x: +g.capy.position.x.toFixed(1),
             z: +g.capy.position.z.toFixed(1), paused: !!g.state.paused };
  });
  await page.evaluate(o => fetch('/shot?name=pf2-finshot-state.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), st);
}
