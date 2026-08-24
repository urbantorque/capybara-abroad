async page => {
  const ids = await page.evaluate(async () => (await fetch('/qa/all-task-ids.json')).json());
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
  // Stand OUTSIDE the mouth, on the line from the spawn — the approach.
  await page.evaluate(() => {
    const g = window.__capy;
    g.capy.body.position.set(23.5, 1.0, 25.4);
    g.capy.body.velocity.set(0, 0, 0);
  });
  // Nudge east for a moment so the camera swings round behind the animal and
  // faces the lawn; a teleport alone leaves the camera pointing wherever it was.
  await page.keyboard.down('KeyD');
  await page.evaluate(() => new Promise(r => setTimeout(r, 700)));
  await page.keyboard.up('KeyD');
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => new Promise(r => setTimeout(r, 1000)));
    await page.evaluate(() => {
      const g = window.__capy;
      const p = g.capy.position;
      const dx = p.x - 23.5, dz = p.z - 25.4;
      if (dx * dx + dz * dz > 3) { g.capy.body.position.set(23.5, 1.0, 25.4); g.capy.body.velocity.set(0, 0, 0); }
    });
  }
  const st = await page.evaluate(() => {
    const g = window.__capy;
    return { loaf: +(g.capy.loaf || 0).toFixed(2), x: +g.capy.position.x.toFixed(1),
             z: +g.capy.position.z.toFixed(1), camYaw: +(g.input.camYaw || 0).toFixed(2),
             paused: !!g.state.paused };
  });
  await page.evaluate(o => fetch('/shot?name=pf2-finshot2-state.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), st);
}
