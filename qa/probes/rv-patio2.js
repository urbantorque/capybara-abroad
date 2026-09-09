async page => {
  await page.reload();
  await page.waitForTimeout(6500);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2000);
  const out = await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('pasto');
    for (let i = 0; i < 300; i++) g.tick(1 / 60, false);
    const P = g.pasto.coffeePatio;
    const byKind = {};
    const rows = [];
    for (const r of g.npcs) {
      const k = (r && r.kind) || '?';
      byKind[k] = (byKind[k] || 0) + 1;
      if (k === 'farmer' || k === 'vendor') {
        const p = r.group ? r.group.position : { x: r.x, z: r.z };
        rows.push({ kind: k, at: [+p.x.toFixed(1), +p.z.toFixed(1)], state: r.state,
          onPatio: Math.abs(p.x - P.x) < P.w / 2 && Math.abs(p.z - P.z) < P.d / 2,
          d: +Math.hypot(p.x - P.x, p.z - P.z).toFixed(1) });
      }
    }
    return { patio: { x: P.x, z: P.z, w: P.w, d: P.d }, npcs: g.npcs.length, byKind, rows };
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rv-patio2.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
