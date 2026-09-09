async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://localhost:5199/index.html');
  await page.waitForTimeout(7000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2500);
  const out = await page.evaluate(() => {
    const g = window.__capy;
    const R = { samples: [] };
    g.biome.switchTo('cali');
    const A = g.cali;
    const b = g.capy.body;
    function put(x, y, z) {
      b.position.set(x, y, z); b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      b.angularVelocity.set(0, 0, 0);
    }
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false);
    const c0 = A.cart();
    R.start = [+c0.x.toFixed(1), +c0.y.toFixed(2), +c0.z.toFixed(1)];
    put(c0.x, c0.y + 1.0, c0.z);
    for (let i = 0; i < 30; i++) g.tick(1 / 60, false);
    R.inCartBefore = A.inCart();
    g.input.actionPressed = true; g.tick(1 / 60, false);
    R.rolling = A.cartRolling();
    let top = 0, t = 0, stopped = -1;
    for (let i = 0; i < 9000; i++) {
      const q = A.cart();
      put(q.x, q.y + 1.0, q.z);
      g.tick(1 / 60, false);
      t += 1 / 60;
      const v = A.cartSpeed();
      if (v > top) top = v;
      if (i % 180 === 0) R.samples.push([+t.toFixed(1), +v.toFixed(2), +q.y.toFixed(1), A.cartRolling(), A.inCart()]);
      if (!A.cartRolling() && i > 60) { stopped = i; break; }
    }
    R.top = +top.toFixed(2);
    R.stoppedAtTick = stopped;
    R.seconds = +t.toFixed(1);
    R.end = (() => { const q = A.cart(); return [+q.x.toFixed(1), +q.y.toFixed(2), +q.z.toFixed(1)]; })();
    R.done = !!g.taskDone('cart-run');
    R.err = g.state.lastError || null;
    return R;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rb-cart.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, out);
}
