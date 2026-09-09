async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2000);
  const out = {};
  const G = () => window.__capy;
  out.room0 = await page.evaluate(() => window.__capy.hud.roomAudit());
  out.calm0 = await page.evaluate(() => window.__capy.hud.calmAudit());
  // locals: are they moving?
  out.locals0 = await page.evaluate(() => {
    const L = window.__capy.locals || [];
    return { n: L.length, sample: L.slice(0, 4).map(r => ({ b: r.biome, x: +r.x.toFixed(3), z: +r.z.toFixed(3), fam: r.fam })) };
  });
  await page.waitForTimeout(8000);
  out.locals1 = await page.evaluate(() => {
    const L = window.__capy.locals || [];
    let moved = 0, maxd = 0;
    for (const r of L) { const d = Math.hypot(r.x - r.ax, r.z - r.az); if (d > 0.01) moved++; if (d > maxd) maxd = d; }
    return { n: L.length, movedFromAnchor: moved, maxDrift: +maxd.toFixed(3),
             sample: L.slice(0, 4).map(r => ({ b: r.biome, x: +r.x.toFixed(3), z: +r.z.toFixed(3) })) };
  });
  await page.evaluate((o) => fetch('/shot?name=w34c.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
