async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5500);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const g = window.__capy;
    g.completeTask('gather', true);
    g.biome.switchTo('antarctic');
  });
  await page.waitForTimeout(2800);
  const out = await page.evaluate(() => {
    const g = window.__capy, c = g.capy, b = c.body;
    const down = k => window.dispatchEvent(new KeyboardEvent('keydown', { code: k, bubbles: true }));
    const up = k => window.dispatchEvent(new KeyboardEvent('keyup', { code: k, bubbles: true }));
    const T = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
    const wheek = () => { down('KeyQ'); T(5); up('KeyQ'); T(16); };
    let K = null;
    b.position.set(0, 40, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    for (let i = 0; i < 60 && !K; i++) {
      T(60 * 2);
      const f = g.herdDebug().kinds.find(x => x.kind === 'leopard seal');
      if (f && f.n > 0 && f.first) K = f;
    }
    if (!K) return { neverOffered: true };
    b.position.set(K.first.x + 8, K.first.y + 0.8, K.first.z + 8);
    b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    T(120);
    const steps = []; let joined = 0;
    for (let w = 1; w <= 5; w++) {
      wheek(); T(24);
      const q = g.herdDebug().kinds.find(x => x.kind === 'leopard seal') || {};
      steps.push({ w, n: q.n || 0, led: q.led || 0, look: q.looking || 0 });
      if (!joined && (q.led || 0) > 0) joined = w;
    }
    return { at: K.first, joinedOnWheek: joined, steps, err: g.state.lastError || null };
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=seal.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, out);
}
