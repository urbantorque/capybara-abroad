async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.reload();
  await wait(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await wait(6500);
  await page.keyboard.press('Digit1');
  await wait(3000);
  await page.evaluate(() => {
    const g = window.__capy;
    try { g.hud.cross('monaco'); } catch (e) { g.biome.switchTo('monaco'); }
    return true;
  });
  await wait(2000);
  const out = await page.evaluate(() => {
    const g = window.__capy, api = g.monaco;
    // The cones as SPAWNED (first live frame), before a car has been past.
    const cones = (g.props || []).filter(p => p.biome === 'monaco' && p.type === 'cone' && p.body)
      .map(p => ({ x: +p.body.position.x.toFixed(2), z: +p.body.position.z.toFixed(2),
                   y: +p.body.position.y.toFixed(2) }));
    // The five that are the chicane sit in one cluster; find it by taking the
    // tightest five.
    const c0 = api.chicane();
    const near = cones.filter(c => Math.hypot(c.x - c0.x, c.z - c0.z) < 20);
    let cx = 0, cz = 0;
    for (const c of near) { cx += c.x; cz += c.z; }
    cx /= near.length || 1; cz /= near.length || 1;
    // Nearest water to that centre, and its bearing.
    let best = null;
    for (let a = 0; a < 360; a += 5) {
      const r = a * Math.PI / 180, sx = Math.sin(r), sz = Math.cos(r);
      for (let d = 1; d <= 40; d += 0.5) {
        const x = cx + sx * d, z = cz + sz * d;
        if (api.isOverWater(x, z)) {
          if (!best || d < best.d) best = { a: a, d: +d.toFixed(1), x: +x.toFixed(1), z: +z.toFixed(1) };
          break;
        }
      }
    }
    // ...and where the cars run: sample the live car positions.
    const cars = [];
    return { cones: cones, chicane: { x: +cx.toFixed(2), z: +cz.toFixed(2) },
             nearestWater: best, cars: cars,
             done: g.taskDone('chicane') };
  });
  // Watch the cones for 25 s with no player input at all, and record whether a
  // car sweeps them and whether the task ticks.
  const watch = [];
  for (let i = 0; i < 5; i++) {
    await wait(5000);
    watch.push(await page.evaluate(() => {
      const g = window.__capy;
      const cs = (g.props || []).filter(p => p.biome === 'monaco' && p.type === 'cone' && p.body);
      let moving = 0, inWater = 0;
      for (const p of cs) {
        if (p.body.velocity.length() > 0.5) moving++;
        if (p.body.position.y < -0.4) inWater++;
      }
      return { t: +g.state.time.toFixed(1), moving: moving, inWater: inWater,
               done: g.taskDone('chicane') };
    }));
  }
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), { out, watch });
  await page.evaluate(s => fetch('/shot?name=f1-mon.json', { method: 'POST', body: s }), bl);
}
