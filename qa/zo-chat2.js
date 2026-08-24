async page => {
  await page.reload(); await page.waitForTimeout(6000);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2200);
  const out = {};
  for (const bm of ['sydney', 'pasto']) {
    out[bm] = await page.evaluate(async (name) => {
      const g = window.__capy;
      g.biome.switchTo(name);
      for (let i = 0; i < 120; i++) g.tick(1/60, false);
      const sp = g.biome.spawnOf(name), b = g.capy.body;
      const hold = () => { b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0);
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position); };
      hold();
      const prev = new Map();
      let exchanges = 0;
      for (let i = 0; i < 60 * 200; i++) {
        hold(); g.tick(1/60, false);
        if (i % 6 === 0) {
          for (const r of g.npcs) {
            if (r.chatCd === undefined) continue;
            const p = prev.get(r);
            if (p !== undefined && r.chatCd > p + 1) exchanges++;
            prev.set(r, r.chatCd);
          }
        }
      }
      return { pairsFired: Math.round(exchanges / 2), err: g.state.lastError || null };
    }, bm);
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=zo.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
