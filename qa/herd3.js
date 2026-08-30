async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5500);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2500);
  await page.evaluate(() => { window.__capy.completeTask('gather', true); });
  const out = {};

  const BIOMES = ['sydney', 'kyoto', 'iceland', 'venice', 'goreme',
                  'manly', 'pantanal', 'antarctic'];
  for (const biome of BIOMES) {
    await page.evaluate((n) => { window.__capy.biome.switchTo(n); }, biome);
    await page.waitForTimeout(2800);
    out[biome] = await page.evaluate(() => {
      const g = window.__capy, c = g.capy;
      const down = k => window.dispatchEvent(new KeyboardEvent('keydown', { code: k, bubbles: true }));
      const up = k => window.dispatchEvent(new KeyboardEvent('keyup', { code: k, bubbles: true }));
      const T = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
      const wheek = () => { down('KeyQ'); T(5); up('KeyQ'); T(16); };
      const rows = [];
      const kinds = g.herdDebug().kinds.slice();
      for (let ki = 0; ki < kinds.length; ki++) {
        const K = kinds[ki];
        if (!K.first || !K.n) { rows.push({ kind: K.kind, obey: K.obey, n: K.n, empty: true }); continue; }
        const b = c.body;
        // out of earshot first, and long enough for the counter to bleed
        b.position.set(K.first.x + 70, K.first.y + 0.6, K.first.z + 70);
        b.velocity.set(0, 0, 0);
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
        T(60 * 12);
        // ...then just outside the animal's own flush radius, and ask
        b.position.set(K.first.x + 8.5, K.first.y + 0.6, K.first.z + 8.5);
        b.velocity.set(0, 0, 0);
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
        T(60 * 3);
        const steps = [];
        let joined = 0;
        for (let w = 1; w <= 4; w++) {
          wheek(); T(20);
          const d = g.herdDebug().kinds.find(x => x.kind === K.kind) || {};
          steps.push({ w, led: d.led || 0, looking: d.looking || 0, heard: d.heard || 0 });
          if (!joined && (d.led || 0) > 0) joined = w;
        }
        rows.push({ kind: K.kind, obey: K.obey, n: K.n, joinedOnWheek: joined, steps });
        // let go before the next kind
        b.position.set(K.first.x + 200, K.first.y + 0.6, K.first.z + 200);
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
        T(60 * 26);
      }
      return { rows, err: g.state.lastError || null };
    });
  }

  await page.evaluate(async (o) => {
    await fetch('/shot?name=herd3.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
