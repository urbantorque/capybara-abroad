async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);
  const r = await page.evaluate(async () => {
    const g = window.__capy;
    g.biome.switchTo('venice');
    for (let i = 0; i < 90; i++) g.tick(1 / 60, false);
    const sp = g.biome.spawnOf('venice');
    const L = (g.locals || []).filter(l => l.biome === 'venice' && l.fig)
      .sort((a, b) => Math.hypot(a.x - sp.x, a.z - sp.z) - Math.hypot(b.x - sp.x, b.z - sp.z));
    const rec = L[0];
    const api = g.venice;
    const px = rec.x + 2.5, pz = rec.z;
    const ty = api.terrainHeight(px, pz);
    g.capy.body.position.set(px, ty + 0.8, pz);
    g.capy.body.velocity.set(0, 0, 0);
    const ev = [];
    let n = 0, prev = 0;
    g.events.on('npc:startled', (e) => ev.push({ t: 'startled', at: +(n / 60).toFixed(1), e: e && e.why || null }));
    const rows = [];
    for (n = 0; n < 60 * 60; n++) {
      g.tick(1 / 60, false);
      const w = rec.wary || 0;
      if (Math.abs(w - prev) > 0.05 || (n % 60 === 0)) {
        rows.push({ t: +(n / 60).toFixed(2), wary: +w.toFixed(3), fam: +(rec.fam || 0).toFixed(3),
          fl: +(rec.fl || 0).toFixed(2), heat: +g.placeHeat(rec.x, rec.z).toFixed(2),
          v: +Math.hypot(g.capy.velocity.x, g.capy.velocity.z).toFixed(2),
          d: +Math.hypot(g.capy.position.x - rec.x, g.capy.position.z - rec.z).toFixed(2),
          watch: +(rec.watching || 0).toFixed(2), own: !!rec.own, sat: +(rec.sat || 0).toFixed(1),
          say: rec.last || '' });
        prev = w;
      }
    }
    return { rows: rows.filter((x, i) => i < 90), ev, first: rec.lines[0] };
  });
  await page.evaluate((o) => fetch('/shot?name=o1-why.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), r);
}
