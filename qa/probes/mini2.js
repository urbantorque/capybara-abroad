async page => {
  const out = await page.evaluate(async () => {
    const errs = [];
    const oldErr = console.error;
    console.error = function (...a) { errs.push(a.map(x => (x && x.stack) || String(x)).join(' ')); oldErr.apply(console, a); };
    window.addEventListener('error', e => errs.push('WINDOW ' + (e.message || e.error)));
    const g = window.__capy;
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const res = {};
    const btns = document.querySelectorAll('.capyui-pick');
    if (btns[0]) btns[0].click();
    await sleep(600);
    const done = Object.create(null);
    g.events.on('task:complete', p => { if (p && p.id) done[p.id] = true; });
    const down = k => window.dispatchEvent(new KeyboardEvent('keydown', { code: k, bubbles: true }));
    const up = k => window.dispatchEvent(new KeyboardEvent('keyup', { code: k, bubbles: true }));
    function place(x, y, z) {
      const b = g.capy.body;
      b.position.set(x, y, z); b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      g.capy.position.set(x, y, z);
    }

    // ---------------- KYOTO: the bonsho ----------------
    g.biome.switchTo('kyoto');
    await sleep(500);
    const k = g.kyoto;
    res.hasBell = !!k.bell;
    const rope = k.bellRope();
    res.rope = { x: +rope.x.toFixed(1), y: +rope.y.toFixed(2), z: +rope.z.toFixed(1) };
    place(rope.x, rope.y + 0.4, rope.z - 1.2);
    await sleep(400);
    down('KeyE'); await sleep(90); up('KeyE');
    await sleep(200);
    // sprint under the bell — teleport, this is a mechanism test not a run test
    place(k.bell.x, g.kyoto.terrainHeight(k.bell.x, k.bell.z) + 0.7, k.bell.z);
    await sleep(200);
    res.under = k.underBell();
    for (let i = 0; i < 90 && !done['the-bell']; i++) await sleep(100);
    res.bellTicked = !!done['the-bell'];
    res.ringing = k.bellRinging();

    // the miss case: it must NOT tick from outside, and must be re-pullable
    await sleep(9500);
    res.ringStopped = !k.bellRinging();

    // ---------------- CALI: la carretilla ----------------
    g.biome.switchTo('cali');
    await sleep(500);
    const c = g.cali;
    res.hasCart = typeof c.cart === 'function';
    let p0 = c.cart();
    res.cartStart = { x: +p0.x.toFixed(1), y: +p0.y.toFixed(2), z: +p0.z.toFixed(1) };
    place(p0.x, p0.y + 1.3, p0.z);
    await sleep(500);
    res.inCartBefore = c.inCart();
    down('KeyE'); await sleep(90); up('KeyE');
    await sleep(200);
    res.rolling = c.cartRolling();
    const trail = [];
    for (let i = 0; i < 1000; i++) {
      await sleep(100);
      const q = c.cart(), cp = g.capy.position;
      if (i % 20 === 0) trail.push({ x: +q.x.toFixed(0), y: +q.y.toFixed(1), z: +q.z.toFixed(0),
                                     in: c.inCart(), roll: c.cartRolling(), v: +c.cartSpeed().toFixed(1) });
      if (done['cart-run']) break;
      if (!c.cartRolling() && i > 30) break;
    }
    res.cartTicked = !!done['cart-run'];
    res.trail = trail;
    res.cartEnd = { x: +c.cart().x.toFixed(1), y: +c.cart().y.toFixed(2), z: +c.cart().z.toFixed(1) };
    res.inCartEnd = c.inCart();
    res.errs = errs;
    res.lastError = g.state && g.state.lastError;
    return res;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=mini2.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
