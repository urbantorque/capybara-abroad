async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://localhost:5199/index.html?cb=' + Math.random());
  await page.waitForTimeout(7000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2500);
  const out = await page.evaluate(() => {
    const g = window.__capy;
    const R = {};
    g.biome.switchTo('rio');
    const A = g.rio;
    const b = g.capy.body;
    function step(n) { for (let i = 0; i < n; i++) g.tick(1 / 60, false); }
    function put(x, y, z) {
      b.position.set(x, y, z); b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      b.angularVelocity.set(0, 0, 0);
    }
    const done = id => !!g.taskDone(id);
    step(120);

    // --- globo ---------------------------------------------------------
    put(A.globo.x + 1, A.terrainHeight(A.globo.x, A.globo.z) + 0.6, A.globo.z + 1);
    step(20);
    g.input.actionPressed = true; g.tick(1 / 60, false);
    step(20);
    R['globo-biscuit'] = done('globo-biscuit');

    // --- kiosk ---------------------------------------------------------
    put(A.kiosk.x, A.terrainHeight(A.kiosk.x, A.kiosk.z) + 2.0, A.kiosk.z);
    step(20);
    g.input.actionPressed = true; g.tick(1 / 60, false);
    step(20);
    R.kiosk = done('kiosk');
    R.kioskY = +(g.capy.position.y - A.terrainHeight(A.kiosk.x, A.kiosk.z)).toFixed(2);

    // --- arpoador -------------------------------------------------------
    put(A.arpoadorRock.x, A.terrainHeight(A.arpoadorRock.x, A.arpoadorRock.z) + 1.2, A.arpoadorRock.z);
    step(60);
    R.arpoador = done('arpoador');

    // --- calcadao -------------------------------------------------------
    const cz = A.calcadao.z;
    put(-70, A.terrainHeight(-70, cz) + 0.6, cz);
    step(20);
    for (let i = 0; i < 1500; i++) {
      const p = g.capy.position;
      put(p.x + 0.12, A.terrainHeight(p.x + 0.12, cz) + 0.6, cz);
      g.tick(1 / 60, false);
      if (done('calcadao')) break;
    }
    R.calcadao = done('calcadao');
    R.calcEndX = +g.capy.position.x.toFixed(1);

    // --- selaron --------------------------------------------------------
    const foot = { x: A.selaron.x, z: A.selaron.z };
    const head = { x: A.selaron.x, z: A.selaron.z + 33 * 1.05 };
    put(foot.x, A.terrainHeight(foot.x, foot.z) + 0.6, foot.z);
    step(60);
    for (let i = 0; i < 600; i++) {
      const p = g.capy.position;
      const nz = Math.min(head.z, p.z + 0.14);
      put(foot.x, A.terrainHeight(foot.x, nz) + 0.6, nz);
      g.tick(1 / 60, false);
      if (done('selaron-steps')) break;
    }
    R['selaron-steps'] = done('selaron-steps');
    R.selEndZ = +g.capy.position.z.toFixed(1);

    // --- bondinho (cable car) -------------------------------------------
    const cab = A.cabin();
    for (let i = 0; i < 6000; i++) {
      const c = A.cabin();
      put(c.position.x, c.position.y - 1.0, c.position.z);
      g.tick(1 / 60, false);
      if (done('bondinho')) break;
    }
    R.bondinho = done('bondinho');
    R.riding = A.riding();

    // --- o-bonde (the tram) ---------------------------------------------
    for (let i = 0; i < 6000; i++) {
      const t = A.bonde();
      put(t.x, t.y + 1.4, t.z);
      g.tick(1 / 60, false);
      if (done('o-bonde')) break;
    }
    R['o-bonde'] = done('o-bonde');
    R.bondePos = (() => { const t = A.bonde(); return [+t.x.toFixed(1), +t.y.toFixed(1), +t.z.toFixed(1)]; })();

    // --- futevolei: find the ball and put it in the sea -------------------
    let ball = null;
    for (const bd of g.world.bodies) {
      if (bd.mass <= 0) continue;
      if (bd === g.capy.body) continue;
      const d = Math.hypot(bd.position.x - A.volei.x, bd.position.z - A.volei.z);
      if (d < 14 && bd.shapes.length === 1 && bd.shapes[0].radius) { ball = bd; break; }
    }
    R.ballFound = !!ball;
    if (ball) {
      ball.position.set(A.volei.x, A.waterLevel + 0.4, -30);
      ball.velocity.set(0, 0, -2);
      ball.previousPosition.copy(ball.position); ball.interpolatedPosition.copy(ball.position);
      ball.wakeUp();
      step(180);
    }
    R.futevolei = done('futevolei');

    // --- take a wave -----------------------------------------------------
    let bestRide = 0, surfFrames = 0;
    for (let cycle = 0; cycle < 3 && !done('take-a-wave'); cycle++) {
      // sit in the pocket: just shoreward of the live crest
      for (let i = 0; i < 1800; i++) {
        const w = A.waveAt();
        const p = g.capy.position;
        if (i === 0 || (!A.surfing() && i % 240 === 0)) {
          put(w.x, A.waterLevel + 0.2, w.z + 1.6);
        }
        g.tick(1 / 60, false);
        if (A.surfing()) surfFrames++;
        if (done('take-a-wave')) break;
      }
    }
    R['take-a-wave'] = done('take-a-wave');
    R.surfFrames = surfFrames;
    R.wet = +(g.capy.wet || 0).toFixed(2);

    R.err = g.state.lastError || null;
    return R;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rb-rio.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
