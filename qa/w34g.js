async page => {
  const out = { chats: {} };
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    window.__qaGo = (name) => {
      const g = window.__capy;
      g.biome.switchTo(name);
      const sp = g.biome.spawnOf(name);
      const b = g.capy.body;
      b.position.set(sp.x, sp.y, sp.z);
      b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position);
      b.interpolatedPosition.copy(b.position);
    };
  });
  for (const n of ['sahara', 'venice', 'cave']) {
    await page.evaluate((nm) => window.__qaGo(nm), n);
    await page.waitForTimeout(1000);
    await page.evaluate((nm) => {
      window.__qaSeen = 0;
      const L = (window.__capy.locals || []).filter(r => r.biome === nm);
      window.__qaWatch = setInterval(() => {
        for (const r of L) if (r.chatT > 0) { window.__qaSeen++; break; }
      }, 250);
    }, n);
    await page.waitForTimeout(22000);
    out.chats[n] = await page.evaluate(() => {
      clearInterval(window.__qaWatch);
      return { ticksWithChat: window.__qaSeen };
    });
  }
  out.err = await page.evaluate(() => String(window.__capy.state.lastError));
  await page.evaluate((o) => fetch('/shot?name=w34g.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
