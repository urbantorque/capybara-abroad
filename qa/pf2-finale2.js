async page => {
  const ids = await page.evaluate(async () => (await fetch('/qa/all-task-ids.json')).json());
  await page.evaluate(o => {
    localStorage.clear();
    localStorage.setItem('capy3.journey.v1', JSON.stringify({
      v: 1, tasks: o.ids, seen: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17], recs: {},
      told: 1, ms: 3600000, chapms: {}, finds: [], foundAt: {}, biome: 'sydney', fin: 0
    }));
  }, { ids: ids });
  await page.reload();
  await page.evaluate(() => new Promise(r => setTimeout(r, 4500)));
  await page.keyboard.press('Digit1');
  await page.evaluate(() => new Promise(r => setTimeout(r, 3500)));

  const out = { sit: [], outside: [] };

  // ---- CONTROL: sit at the SPAWN, well outside the ring, and confirm the
  // ---- ending does NOT fire just because the animal is loafing somewhere.
  for (let i = 0; i < 11; i++) {
    await page.evaluate(() => new Promise(r => setTimeout(r, 1000)));
    const s = await page.evaluate(() => {
      const g = window.__capy;
      const e = document.querySelector('.capyui-led');
      return { x: +g.capy.position.x.toFixed(1), z: +g.capy.position.z.toFixed(1),
               loaf: +(g.capy.loaf || 0).toFixed(2),
               led: !!(e && e.classList.contains('show')) };
    });
    if (i % 3 === 0 || s.led) out.outside.push(s);
    if (s.led) { out.controlFailed = true; break; }
  }

  // ---- Now put the animal in the middle of the ring. Teleport-and-park: place
  // ---- once, then only re-place if it has drifted, because re-placing every
  // ---- frame means it never reports grounded and the loaf can never start.
  await page.evaluate(() => {
    const g = window.__capy;
    g.capy.body.position.set(30, 1.0, 26);
    g.capy.body.velocity.set(0, 0, 0);
    g.capy.body.angularVelocity.set(0, 0, 0);
  });
  for (let i = 0; i < 20; i++) {
    await page.evaluate(() => new Promise(r => setTimeout(r, 1000)));
    const s = await page.evaluate(() => {
      const g = window.__capy;
      const p = g.capy.position;
      const dx = p.x - 30, dz = p.z - 26;
      if (dx * dx + dz * dz > 4) {           // drifted out of the middle: put it back
        g.capy.body.position.set(30, 1.0, 26);
        g.capy.body.velocity.set(0, 0, 0);
      }
      const e = document.querySelector('.capyui-led');
      return { x: +p.x.toFixed(1), z: +p.z.toFixed(1),
               loaf: +(g.capy.loaf || 0).toFixed(2),
               grounded: !!g.capy.grounded,
               paused: !!g.state.paused,
               led: !!(e && e.classList.contains('show')),
               title: e && e.classList.contains('show') ? (e.textContent || '').slice(0, 70) : null };
    });
    out.sit.push({ s: i + 1, x: s.x, z: s.z, loaf: s.loaf, grounded: s.grounded,
                   paused: s.paused, led: s.led });
    if (s.led) { out.ledTitle = s.title; out.firedAtSecond = i + 1; break; }
  }
  await page.evaluate(() => new Promise(r => setTimeout(r, 1200)));
  out.saved = await page.evaluate(() => {
    try { return { fin: JSON.parse(localStorage.getItem('capy3.journey.v1')).fin }; }
    catch (e) { return { err: String(e) }; }
  });
  out.err = await page.evaluate(() => {
    const g = window.__capy; return g.state.lastError ? String(g.state.lastError) : null;
  });
  const b = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=pf2-finale2.json', { method: 'POST', body: s }), b);
}
