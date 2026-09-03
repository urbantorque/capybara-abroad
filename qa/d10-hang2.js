async page => {
  // Eleven of nineteen hung things measured exactly 0.0000 from the chapter
  // spawn. physHANG_FAR is 70 m and an exit board is rarely within 70 m of a
  // spawn, so the first question is whether that is the cull doing its job or
  // a dead pendulum. This stands the capybara SIX METRES from each one and
  // asks again — and then shouts at it, which is the channel that does not
  // depend on the weather at all.
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} });
  await page.setViewportSize({ width: 1280, height: 760 });
  await page.goto('http://localhost:5188/');
  await wait(6500);
  await page.keyboard.press('Digit1');
  await wait(5000);

  const ALL = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland', 'sahara',
               'drift', 'venice', 'kowloon', 'palawan', 'goreme', 'manly', 'pantanal',
               'cave', 'antarctic', 'monaco', 'hanoi'];
  const rows = [];
  for (let i = 0; i < ALL.length; i++) {
    await page.evaluate(function (name) {
      const g = window.__capy;
      g.biome.switchTo(name);
      return true;
    }, ALL[i]);
    await wait(2200);
    // ...now put the animal next to the thing, wherever the board went.
    const where = await page.evaluate(function () {
      const g = window.__capy;
      const h = g.hangAudit();
      if (!h.rows.length) return null;
      const r = h.rows[0];
      const b = g.capy.body;
      b.position.set(r.x + 4, r.y + 2.5, r.z + 4);
      b.velocity.set(0, 0, 0);
      return { x: r.x, y: r.y, z: r.z, len: r.len, wind: r.wind, voice: r.voice };
    });
    await wait(1200);
    await page.evaluate(function () {
      const g = window.__capy;
      const w = window.__h2 = { max: 0, n: 0, awake: 0, dmin: 1e9 };
      window.__h2T = setInterval(function () {
        const h = g.hangAudit();
        if (!h.rows.length) return;
        const r = h.rows[0], c = g.capy.position;
        w.n++;
        w.air = h.air;
        if (r.a > w.max) w.max = r.a;
        if (!r.asleep) w.awake++;
        const d = Math.hypot(r.x - c.x, r.y - c.y, r.z - c.z);
        if (d < w.dmin) w.dmin = d;
      }, 90);
      return true;
    });
    await wait(9000);
    // ...and now shout, which is the channel with no weather in it.
    const wind = await page.evaluate(function () {
      const w = window.__h2;
      return { peakWind: +w.max.toFixed(4), awake: w.awake, n: w.n,
               d: +w.dmin.toFixed(1), air: w.air };
    });
    await page.evaluate(function () { window.__h2.max = 0; });
    await page.keyboard.press('KeyQ');
    await wait(2500);
    const shout = await page.evaluate(function (name) {
      const g = window.__capy;
      clearInterval(window.__h2T);
      return { peakShout: +window.__h2.max.toFixed(4),
               err: g.state.lastError ? String(g.state.lastError) : null };
    }, ALL[i]);
    rows.push(Object.assign({ n: ALL[i] }, where || { none: true }, wind, shout));
  }
  const bl = await page.evaluate(o =>
    btoa(unescape(encodeURIComponent(JSON.stringify({ rows: o }, null, 1)))), rows);
  await page.evaluate(s => fetch('/shot?name=d10-hang2.json', { method: 'POST', body: s }), bl);
}
