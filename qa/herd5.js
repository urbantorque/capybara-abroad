async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5500);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2500);
  await page.evaluate(() => { window.__capy.completeTask('gather', true); });
  const out = {};
  // manly gulls flush at manGULL_NEAR = 7 m, so they must be called from
  // outside it — the same shape as the heron and the seal. Sweep the standoff.
  await page.evaluate(() => { window.__capy.biome.switchTo('manly'); });
  await page.waitForTimeout(2800);
  out.manly = await page.evaluate(() => {
    const g = window.__capy, c = g.capy, b = c.body;
    const down = k => window.dispatchEvent(new KeyboardEvent('keydown', { code: k, bubbles: true }));
    const up = k => window.dispatchEvent(new KeyboardEvent('keyup', { code: k, bubbles: true }));
    const T = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
    const wheek = () => { down('KeyQ'); T(5); up('KeyQ'); T(16); };
    const rows = [];
    for (const d of [9, 11, 13]) {
      b.position.set(0, 40, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      T(60 * 14);
      const K = g.herdDebug().kinds.find(x => x.kind === 'silver gull');
      if (!K || !K.first) { rows.push({ d, gone: true }); continue; }
      b.position.set(K.first.x + d * 0.7071, K.first.y + 0.5, K.first.z + d * 0.7071);
      b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      T(60 * 3);
      const steps = []; let joined = 0;
      for (let w = 1; w <= 4; w++) {
        wheek(); T(20);
        const q = g.herdDebug().kinds.find(x => x.kind === 'silver gull') || {};
        steps.push({ w, led: q.led || 0, look: q.looking || 0 });
        if (!joined && (q.led || 0) > 0) joined = w;
      }
      rows.push({ d, joinedOnWheek: joined, steps });
    }
    return rows;
  });
  // the leopard seal: wait until it is hauled out, then ask from 11 m
  await page.evaluate(() => { window.__capy.biome.switchTo('antarctic'); });
  await page.waitForTimeout(2800);
  out.seal = await page.evaluate(async () => {
    const g = window.__capy, c = g.capy, b = c.body;
    const down = k => window.dispatchEvent(new KeyboardEvent('keydown', { code: k, bubbles: true }));
    const up = k => window.dispatchEvent(new KeyboardEvent('keyup', { code: k, bubbles: true }));
    const T = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
    const wheek = () => { down('KeyQ'); T(5); up('KeyQ'); T(16); };
    let K = null, waited = 0;
    b.position.set(0, 40, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    for (let i = 0; i < 90 && !K; i++) {
      T(60 * 2); waited += 2;
      const f = g.herdDebug().kinds.find(x => x.kind === 'leopard seal');
      if (f && f.n > 0 && f.first) K = f;
    }
    if (!K) return { neverHauled: true, waited };
    b.position.set(K.first.x + 8, K.first.y + 0.6, K.first.z + 8);
    b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    T(90);
    const steps = []; let joined = 0;
    for (let w = 1; w <= 5; w++) {
      wheek(); T(20);
      const q = g.herdDebug().kinds.find(x => x.kind === 'leopard seal') || {};
      steps.push({ w, n: q.n || 0, led: q.led || 0, look: q.looking || 0 });
      if (!joined && (q.led || 0) > 0) joined = w;
    }
    return { waited, at: K.first, joinedOnWheek: joined, steps };
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=herd5.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
