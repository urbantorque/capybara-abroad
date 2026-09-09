async page => {
  const go = async (key) => {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(600);
    await page.keyboard.press(key);
    await page.waitForTimeout(3500);
  };
  const out = {};
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(1500);
  await go('BracketLeft');            // chapter 13 — Cappadocia
  out.biome = await page.evaluate(() => window.__capy.biome.current);
  await page.waitForTimeout(4000);
  out.calmA = await page.evaluate(() => window.__capy.hud.calmAudit());
  out.roomA = await page.evaluate(() => window.__capy.hud.roomAudit());
  out.localsA = await page.evaluate(() => {
    const L = (window.__capy.locals || []).filter(r => r.biome === 'goreme');
    let moved = 0, maxd = 0;
    for (const r of L) { const d = Math.hypot(r.x - r.ax, r.z - r.az); if (d > 0.01) moved++; if (d > maxd) maxd = d; }
    return { n: L.length, moved, maxDrift: +maxd.toFixed(3), fam: L.map(r => +r.fam.toFixed(3)) };
  });
  await page.evaluate((o) => fetch('/shot?name=w34d.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
