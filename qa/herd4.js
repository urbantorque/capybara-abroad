async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5500);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2500);
  await page.evaluate(() => { window.__capy.completeTask('gather', true); });
  const out = {};
  const B = ['sydney','kyoto','iceland','venice','goreme','manly','pantanal','antarctic'];
  for (const biome of B) {
    await page.evaluate((n) => { window.__capy.biome.switchTo(n); }, biome);
    await page.waitForTimeout(2800);
    out[biome] = await page.evaluate(() => {
      const g = window.__capy, c = g.capy;
      const down = k => window.dispatchEvent(new KeyboardEvent('keydown', { code: k, bubbles: true }));
      const up = k => window.dispatchEvent(new KeyboardEvent('keyup', { code: k, bubbles: true }));
      const T = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
      const wheek = () => { down('KeyQ'); T(5); up('KeyQ'); T(16); };
      const rows = [];
      const names = g.herdDebug().kinds.map(k => k.kind);
      for (const name of names) {
        const b = c.body;
        // WALK AWAY AND LET THE COUNTER BLEED. `heardT` is 7.5 s; a chapter
        // measured straight after another one carries its wheeks in.
        let K = g.herdDebug().kinds.find(x => x.kind === name);
        if (!K || !K.first || !K.n) { rows.push({ kind: name, empty: true }); continue; }
        b.position.set(K.first.x + 90, K.first.y + 0.6, K.first.z + 90);
        b.velocity.set(0, 0, 0);
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
        T(60 * 12);
        // RE-READ. The flocks move: standing 12 m from where the first pigeon
        // was thirty-eight seconds ago is standing nowhere near a pigeon, and
        // that is what made four chapters look unwired in the last run.
        K = g.herdDebug().kinds.find(x => x.kind === name);
        if (!K || !K.first || !K.n) { rows.push({ kind: name, gone: true }); continue; }
        // ...and the standoff is per animal: the shy two flush if you walk up.
        const shy = (name === 'heron' || name === 'leopard seal');
        const d = shy ? 11.5 : 3.2;
        b.position.set(K.first.x + d * 0.7071, K.first.y + 0.6, K.first.z + d * 0.7071);
        b.velocity.set(0, 0, 0);
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
        T(60 * 3);
        const K2 = g.herdDebug().kinds.find(x => x.kind === name);
        const p = c.position;
        const dist = K2 && K2.first ? Math.hypot(K2.first.x - p.x, K2.first.z - p.z) : -1;
        const steps = []; let joined = 0;
        for (let w = 1; w <= 4; w++) {
          wheek(); T(20);
          const q = g.herdDebug().kinds.find(x => x.kind === name) || {};
          steps.push({ w, led: q.led || 0, look: q.looking || 0 });
          if (!joined && (q.led || 0) > 0) joined = w;
        }
        rows.push({ kind: name, obey: K.obey, n: K.n, standoff: +dist.toFixed(1),
                    joinedOnWheek: joined, steps });
        b.position.set(K.first.x + 220, K.first.y + 0.6, K.first.z + 220);
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
        T(60 * 26);
      }
      return { rows, err: g.state.lastError || null };
    });
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=herd4.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
