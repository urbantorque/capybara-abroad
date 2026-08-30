async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5500);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const g = window.__capy;
    g.completeTask('gather', true);
    g.biome.switchTo('kyoto');
  });
  await page.waitForTimeout(2800);
  const out = await page.evaluate(() => {
    const g = window.__capy, c = g.capy;
    const down = k => window.dispatchEvent(new KeyboardEvent('keydown', { code: k, bubbles: true }));
    const up = k => window.dispatchEvent(new KeyboardEvent('keyup', { code: k, bubbles: true }));
    const T = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
    const wheek = () => { down('KeyQ'); T(5); up('KeyQ'); T(16); };
    const d0 = g.herdDebug();
    const K = d0.kinds.find(k => k.kind === 'heron');
    if (!K || !K.first) return { noHeron: true, dbg: d0 };
    const A = K.first;
    const log = [];
    // stand OUTSIDE the flush radius (kyoHERON_NEAR is 9 m) and sit still, so
    // the calm registry lets the reach shrink. Then ask, three times.
    for (const dist of [12, 10.5, 9.5]) {
      const b = c.body;
      b.position.set(A.x + dist * 0.7071, A.y + 0.4, A.z + dist * 0.7071);
      b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      T(60 * 14);                                   // sit still: build the calm
      const before = g.herdDebug().kinds.find(k => k.kind === 'heron');
      const steps = [];
      for (let w = 1; w <= 4; w++) {
        wheek(); T(24);
        const h = g.herdDebug().kinds.find(k => k.kind === 'heron');
        steps.push({ w, n: h ? h.n : 0, led: h ? h.led : 0,
                     looking: h ? h.looking : 0, heard: h ? h.heard : 0 });
      }
      log.push({ dist, standingBefore: before ? before.n : 0, calm: +g.calm().toFixed(2), steps });
    }
    return { heronAt: A, log, err: g.state.lastError || null };
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=heron.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
