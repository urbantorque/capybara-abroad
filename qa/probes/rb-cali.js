async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://localhost:5199/index.html?cb=' + Math.random());
  await page.waitForTimeout(7000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2500);
  const out = await page.evaluate(() => {
    const g = window.__capy;
    const R = { log: [] };
    g.biome.switchTo('cali');
    const A = g.cali;
    const b = g.capy.body;
    function step(n) { for (let i = 0; i < n; i++) g.tick(1 / 60, false); }
    function put(x, y, z) {
      b.position.set(x, y, z); b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      b.angularVelocity.set(0, 0, 0);
    }
    function press(name, n) {
      for (let i = 0; i < (n || 1); i++) { g.input[name] = true; g.tick(1 / 60, false); }
    }
    step(120);
    const done = id => !!g.taskDone(id);

    // --- gato ---------------------------------------------------------
    put(A.gato.x, A.terrainHeight(A.gato.x, A.gato.z) + 1.4, A.gato.z);
    step(90);
    R['gato-sit'] = done('gato-sit');

    // --- lulada -------------------------------------------------------
    put(A.lulada.x + 0.6, A.terrainHeight(A.lulada.x, A.lulada.z) + 1.3, A.lulada.z - 0.1);
    step(90);
    R.lulada = done('lulada');

    // --- puente ortiz: swim through under the bridge -------------------
    const bx = A.bridge.x;
    put(bx, A.waterLevel - 0.2, 8.5);
    step(30);
    for (let i = 0; i < 400; i++) {
      const p = g.capy.position;
      if (p.z > -9) put(bx, A.waterLevel - 0.2, p.z - 0.06); else break;
      g.tick(1 / 60, false);
    }
    R['puente-ortiz'] = done('puente-ortiz');
    R.ortizEnd = [+g.capy.position.z.toFixed(1), +g.capy.position.y.toFixed(2)];

    // --- cane run -----------------------------------------------------
    const cane = A.cane;
    put(cane.x - 20, A.terrainHeight(cane.x - 20, cane.z) + 0.6, cane.z);
    step(30);
    for (let i = 0; i < 700; i++) {
      const p = g.capy.position;
      put(p.x + 0.1, A.terrainHeight(p.x + 0.1, cane.z) + 0.6, cane.z);
      g.tick(1 / 60, false);
      if (done('cane-run')) break;
    }
    R['cane-run'] = done('cane-run');

    // --- cristo rey ---------------------------------------------------
    put(A.cristo.x, A.terrainHeight(A.cristo.x, A.cristo.z) + 1.6, A.cristo.z);
    step(90);
    R['cristo-rey'] = done('cristo-rey');

    // --- the cart -----------------------------------------------------
    let c = A.cart();
    R.cartStart = [+c.x.toFixed(1), +c.y.toFixed(1), +c.z.toFixed(1)];
    put(c.x + 2.0, c.y + 1.0, c.z);
    step(30);
    g.input.actionPressed = true; g.tick(1 / 60, false);
    step(10);
    R.cartRolling = A.cartRolling();
    // ride it: sit in the tray
    for (let i = 0; i < 2000; i++) {
      const q = A.cart();
      put(q.x, q.y + 1.0, q.z);
      g.tick(1 / 60, false);
      if (done('cart-run')) break;
    }
    R['cart-run'] = done('cart-run');
    R.cartTop = +A.cartSpeed().toFixed(2);

    // --- the chiva ----------------------------------------------------
    let ch = A.chivaAt();
    R.chivaState0 = A.chivaState();
    put(ch.x, ch.y + 4.05, ch.z);
    for (let i = 0; i < 200; i++) { const q = A.chivaAt(); put(q.x, q.y + 4.05, q.z); g.tick(1 / 60, false); }
    R['chiva-ride'] = done('chiva-ride');
    R.chivaState1 = A.chivaState();
    let ticks = 0;
    for (let i = 0; i < 20000; i++) {
      const q = A.chivaAt();
      put(q.x, q.y + 4.05, q.z);
      g.tick(1 / 60, false);
      ticks++;
      if (A.chivaState() === 'arrived') break;
    }
    R.rideTicks = ticks;
    R.chivaState2 = A.chivaState();
    step(120);
    R['chiva-mirador'] = done('chiva-mirador');
    R.rideProgress = +A.rideProgress().toFixed(3);
    R.night = +A.night().toFixed(2);
    R.err = g.state.lastError || null;
    R.musicPlaying = !!(g.music && g.music.playing);
    return R;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rb-cali.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
