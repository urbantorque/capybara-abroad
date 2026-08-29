async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://localhost:5199/index.html?cb=' + Math.random());
  await page.waitForTimeout(7000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2500);
  const R = {};
  await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('sahara');
    for (let i = 0; i < 180; i++) g.tick(1 / 60, false);
  });
  R.square = await page.evaluate(() => {
    const g = window.__capy; const A = g.sahara; const b = g.capy.body;
    const put = (x, y, z) => { b.position.set(x, y, z); b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position); };
    const S = {};
    // orange cart
    put(A.cart.x + 1.5, A.terrainHeight(A.cart.x + 1.5, A.cart.z) + 0.6, A.cart.z);
    for (let i = 0; i < 40; i++) g.tick(1 / 60, false);
    g.input.actionPressed = true; g.tick(1 / 60, false);
    for (let i = 0; i < 20; i++) g.tick(1 / 60, false);
    S['orange-cart'] = !!g.taskDone('orange-cart');
    S.chasing = A.chasing();
    // snake basket: drop in
    const gy = A.terrainHeight(A.basket.x, A.basket.z);
    put(A.basket.x, gy + 1.6, A.basket.z);
    for (let i = 0; i < 200; i++) g.tick(1 / 60, false);
    S.basketY = +(g.capy.position.y - gy).toFixed(2);
    S['snake-basket'] = !!g.taskDone('snake-basket');
    // date palm
    put(A.datePalm.x + 1.2, A.terrainHeight(A.datePalm.x + 1.2, A.datePalm.z) + 0.6, A.datePalm.z);
    for (let i = 0; i < 40; i++) g.tick(1 / 60, false);
    g.input.actionPressed = true; g.tick(1 / 60, false);
    for (let i = 0; i < 30; i++) g.tick(1 / 60, false);
    S['date-palm'] = !!g.taskDone('date-palm');
    // fire circle
    put(A.camp.x + 2, A.terrainHeight(A.camp.x + 2, A.camp.z) + 0.6, A.camp.z);
    for (let i = 0; i < 40; i++) g.tick(1 / 60, false);
    g.input.actionPressed = true; g.tick(1 / 60, false);
    for (let i = 0; i < 30; i++) g.tick(1 / 60, false);
    S['fire-circle'] = !!g.taskDone('fire-circle');
    S.err = g.state.lastError || null;
    return S;
  });
  // acrobats
  R.acro = await page.evaluate(() => {
    const g = window.__capy; const A = g.sahara; const b = g.capy.body;
    const m = A.acrobatMat();
    b.position.set(m.x, A.terrainHeight(m.x, m.z) + 0.5, m.z); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
    g.input.actionPressed = true; g.tick(1 / 60, false);
    let top = 0;
    for (let i = 0; i < 600; i++) {
      g.tick(1 / 60, false);
      const h = g.capy.position.y - A.terrainHeight(m.x, m.z);
      if (h > top) top = h;
      if (g.taskDone('acrobats')) break;
    }
    return { done: !!g.taskDone('acrobats'), top: +top.toFixed(2),
             apex: +A.acrobatTop().toFixed(2), err: g.state.lastError || null };
  });
  // souk escape
  R.escape = await page.evaluate(() => {
    const g = window.__capy; const A = g.sahara; const b = g.capy.body;
    const put = (x, y, z) => { b.position.set(x, y, z); b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position); };
    // re-arm the chase
    put(A.cart.x + 1.5, A.terrainHeight(A.cart.x + 1.5, A.cart.z) + 0.6, A.cart.z);
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
    g.input.actionPressed = true; g.tick(1 / 60, false);
    for (let i = 0; i < 30; i++) g.tick(1 / 60, false);
    const chasing = A.chasing();
    // and run deep into the souk
    put(A.souk.x, A.terrainHeight(A.souk.x, A.souk.z) + 0.6, A.souk.z);
    for (let i = 0; i < 1200; i++) {
      g.tick(1 / 60, false);
      if (g.taskDone('souk-escape')) break;
      if (i % 30 === 0) put(A.souk.x, A.terrainHeight(A.souk.x, A.souk.z) + 0.6, A.souk.z);
    }
    return { chasing: chasing, done: !!g.taskDone('souk-escape'),
             near: +A.chaseNear().toFixed(1), err: g.state.lastError || null };
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rb-sah.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, R);
}
