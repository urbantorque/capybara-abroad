async page => {
  const out = {};
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
  await page.evaluate(() => window.__qaGo('goreme'));
  await page.waitForTimeout(6000);
  out.biome = await page.evaluate(() => window.__capy.biome.current);
  out.calmA = await page.evaluate(() => window.__capy.hud.calmAudit());
  out.roomA = await page.evaluate(() => window.__capy.hud.roomAudit());
  out.localsA = await page.evaluate(() => {
    const L = (window.__capy.locals || []).filter(r => r.biome === 'goreme');
    let moved = 0, maxd = 0;
    for (const r of L) { const d = Math.hypot(r.x - r.ax, r.z - r.az); if (d > 0.01) moved++; if (d > maxd) maxd = d; }
    return { n: L.length, moved, maxDrift: +maxd.toFixed(3) };
  });
  await page.waitForTimeout(14000);
  out.localsB = await page.evaluate(() => {
    const L = (window.__capy.locals || []).filter(r => r.biome === 'goreme');
    let moved = 0, maxd = 0, chatting = 0;
    for (const r of L) { const d = Math.hypot(r.x - r.ax, r.z - r.az); if (d > 0.01) moved++; if (d > maxd) maxd = d; if (r.chatT > 0) chatting++; }
    return { n: L.length, moved, maxDrift: +maxd.toFixed(3), chatting };
  });
  out.calmB = await page.evaluate(() => window.__capy.hud.calmAudit());
  out.err = await page.evaluate(() => String(window.__capy.state.lastError));
  await page.evaluate((o) => fetch('/shot?name=w34e.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
