async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2500);
  const out = await page.evaluate(async () => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    const g = window.__capy;
    if (g.biome.current !== 'hanoi') { g.biome.switchTo('hanoi'); await sleep(1800); }
    const r = { live: g.biome.current, tests: [] };
    if (r.live !== 'hanoi') return r;
    const api = g.hanoi;
    // backVoid needs `started`; the title card was dismissed above.
    r.started = !!g.state.started;
    const put = (x, z) => {
      const b = g.capy.body;
      g.capy.carriedBy = null;
      b.position.set(x, api.terrainHeight(x, z) + 0.7, z);
      b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    };
    // sysVOID_HOLD is 0.35 s, so 60 frames is plenty, and the rescue moves the
    // animal a long way — that displacement IS the test.
    for (const p of [[-200, -78, 'far west, outside'], [-120, -78, 'west, inside'],
                     [-60, -78, 'the spawn'], [0, -170, 'far south, outside'],
                     [44, 230, 'on the bridge, inside'], [44, 265, 'past the bridge, outside']]) {
      put(p[0], p[1]);
      for (let i = 0; i < 90; i++) g.tick(1 / 60, false);
      const b = g.capy.body;
      const moved = Math.hypot(b.position.x - p[0], b.position.z - p[1]);
      r.tests.push({ at: [p[0], p[1]], what: p[2], moved: +moved.toFixed(1),
                     rescued: moved > 30,
                     to: [Math.round(b.position.x), Math.round(b.position.z)] });
    }
    // ...and what a tick costs, with Sydney in the same session as the control
    // (b3-perf does not hold a line across browser sessions).
    const ms = {};
    for (const tag of ['hanoi', 'sydney']) {
      if (g.biome.current !== tag) { g.biome.switchTo(tag); await sleep(1400); }
      for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
      const t = [];
      for (let i = 0; i < 180; i++) {
        const t0 = performance.now();
        g.tick(1 / 60, false);
        t.push(performance.now() - t0);
      }
      t.sort((a, b) => a - b);
      ms[tag] = { med: +t[90].toFixed(2), p90: +t[162].toFixed(2) };
    }
    r.ms = ms;
    return r;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b9-bounds.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);
}
