async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.reload();
  await wait(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await wait(6500);
  await page.keyboard.press('Digit1');
  await wait(3500);

  const out = {};
  const cross = n => page.evaluate(function (n) {
    const g = window.__capy;
    try { g.hud.cross(n); } catch (e) { g.biome.switchTo(n); }
    return true;
  }, n);
  const camRow = tag => page.evaluate(function (tag) {
    const g = window.__capy;
    const c = g.camera.position, p = g.capy.position;
    return { tag: tag, biome: g.biome.current,
             dist: +Math.hypot(c.x - p.x, c.y - p.y, c.z - p.z).toFixed(2),
             dy: +(c.y - p.y).toFixed(2),
             cam: [+c.x.toFixed(1), +c.y.toFixed(1), +c.z.toFixed(1)],
             capy: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)] };
  }, tag);

  // --- A: the arrival-zoom differential. Manly from Sydney vs from Goreme. ---
  out.cam = [];
  await cross('sydney'); await wait(5000);
  out.cam.push(await camRow('sydney (origin)'));
  await cross('manly'); await wait(9000);
  out.cam.push(await camRow('manly FROM sydney'));
  await page.screenshot({ path: 'qa/F1B-manly-from-sydney.png' });

  await cross('goreme'); await wait(9000);
  out.cam.push(await camRow('goreme (origin)'));
  await cross('manly'); await wait(9000);
  out.cam.push(await camRow('manly FROM goreme'));
  await page.screenshot({ path: 'qa/F1B-manly-from-goreme.png' });

  // ...and the same pair with a deliberate player zoom-out in between.
  await cross('sydney'); await wait(5000);
  for (let i = 0; i < 14; i++) await page.mouse.wheel(0, 120);
  await wait(2500);
  out.cam.push(await camRow('sydney after wheel-out'));
  await cross('manly'); await wait(9000);
  out.cam.push(await camRow('manly FROM zoomed sydney'));
  await page.screenshot({ path: 'qa/F1B-manly-from-zoomed.png' });

  // --- B: Monaco. Which side of the track is the harbour, and the cones. ---
  await cross('monaco'); await wait(6000);
  out.monaco = await page.evaluate(() => {
    const g = window.__capy, api = g.monaco;
    const cones = (g.props || []).filter(p => p.biome === 'monaco' && p.type === 'cone' && p.body)
      .map(p => ({ x: +p.body.position.x.toFixed(2), y: +p.body.position.y.toFixed(2),
                   z: +p.body.position.z.toFixed(2),
                   v: +p.body.velocity.length().toFixed(2) }));
    // The chicane's own centre, and a cut across the track normal there, so the
    // harbour side is measured rather than guessed.
    const c = api && api.chicane ? api.chicane() : null;
    const cut = [];
    if (c && api) {
      // Sample a 24 m square around the chicane centre in both world axes;
      // the normal is unknown out here, so report both cuts and pick later.
      for (let d = -12; d <= 12; d += 2) {
        cut.push({ d: d,
          xh: +api.terrainHeight(c.x + d, c.z).toFixed(2),
          xw: !!api.isOverWater(c.x + d, c.z),
          zh: +api.terrainHeight(c.x, c.z + d).toFixed(2),
          zw: !!api.isOverWater(c.x, c.z + d) });
      }
    }
    return { cones: cones, chicaneDone: g.taskDone('chicane'), t: +g.state.time.toFixed(1),
             centre: c ? { x: +c.x.toFixed(2), z: +c.z.toFixed(2) } : null,
             water: api ? api.waterLevel : null, cut: cut };
  });
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=f1-before.json', { method: 'POST', body: s }), bl);
}
