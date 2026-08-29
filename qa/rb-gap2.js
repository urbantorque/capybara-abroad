async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://localhost:5199/index.html');
  await page.waitForTimeout(7000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2500);
  const R = await page.evaluate(() => {
    const g = window.__capy; const A = g.drift;
    g.biome.switchTo('drift');
    for (let i = 0; i < 180; i++) g.tick(1 / 60, false);
    const b = g.capy.body;
    const S = { runs: [] };
    // shelf extent along x at z = 36
    const scan = [];
    for (let x = -30; x <= 30; x += 2) scan.push([x, +A.terrainHeight(x, 36).toFixed(1)]);
    S.scan = scan;
    // a flat launch across the shelf, with the stick held only while rising
    for (const cfg of [[11, 7, 40], [13, 7, 60], [9, 6, 30]]) {
      b.position.set(-14, A.terrainHeight(-14, 36) + 0.5, 36);
      b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      for (let i = 0; i < 40; i++) g.tick(1 / 60, false);
      const x0 = g.capy.position.x;
      g.capy.launch(cfg[0], cfg[1], 0);
      let landed = -1;
      for (let i = 0; i < 400; i++) {
        if (i < cfg[2]) { g.input.x = 1; g.input.z = 0; g.input.camYaw = 0; g.input.run = true; }
        g.tick(1 / 60, false);
        if (i > 10 && g.capy.grounded) { landed = i; break; }
      }
      S.runs.push({ cfg: cfg, landed: landed,
                    dist: +(g.capy.position.x - x0).toFixed(1),
                    y: +g.capy.position.y.toFixed(1),
                    done: !!g.taskDone('long-gap') });
      if (g.taskDone('long-gap')) break;
    }
    S.done = !!g.taskDone('long-gap');
    S.err = g.state.lastError || null;
    return S;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rb-gap2.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, R);
}
