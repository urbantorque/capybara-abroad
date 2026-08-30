async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5500);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2500);
  await page.evaluate(() => { window.__capy.completeTask('gather', true); });
  const B = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift','venice',
             'kowloon','palawan','goreme','manly','pantanal','cave','antarctic','monaco','hanoi'];
  const rows = [];
  for (const b of B) {
    await page.evaluate((n) => {
      const g = window.__capy;
      g.biome.switchTo(n);
      const sp = g.biome.spawnOf(n), bd = g.capy.body;
      bd.position.set(sp.x, sp.y + 0.4, sp.z); bd.velocity.set(0, 0, 0);
      bd.previousPosition.copy(bd.position); bd.interpolatedPosition.copy(bd.position);
    }, b);
    await page.waitForTimeout(1400);
    rows.push(await page.evaluate(() => {
      const g = window.__capy;
      const down = k => window.dispatchEvent(new KeyboardEvent('keydown', { code: k, bubbles: true }));
      const up = k => window.dispatchEvent(new KeyboardEvent('keyup', { code: k, bubbles: true }));
      const T = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
      for (let i = 0; i < 6; i++) { down('KeyQ'); T(5); up('KeyQ'); T(25); }
      down('KeyW'); T(60 * 4); up('KeyW'); T(30);
      const d = g.herdDebug();
      const p = g.capy.position;
      return { biome: d.biome, kinds: d.kinds.map(k => k.kind + ':' + k.obey + '/' + k.n).join(' '),
               following: d.total,
               nan: !(p.x === p.x && p.y === p.y && p.z === p.z),
               err: g.state.lastError || null };
    }));
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=herdsoak.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, rows);
}
