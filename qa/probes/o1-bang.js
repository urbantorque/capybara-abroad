async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);
  const rows = [];
  for (const nm of ['venice', 'quay', 'rio', 'goreme']) {
    rows.push(await page.evaluate(async (nm) => {
      const g = window.__capy;
      g.biome.switchTo(nm);
      for (let i = 0; i < 90; i++) g.tick(1 / 60, false);
      const sp = g.biome.spawnOf(nm);
      const L = (g.locals || []).filter(l => l.biome === nm && l.fig)
        .sort((a, b) => Math.hypot(a.x - sp.x, a.z - sp.z) - Math.hypot(b.x - sp.x, b.z - sp.z));
      const rec = L[0];
      const api = (nm === 'sydney') ? g.env : g[nm];
      const px = rec.x + 2.5, pz = rec.z;
      const ty = api.terrainHeight(px, pz);
      g.capy.body.position.set(px, ty + 0.35, pz);
      g.capy.body.velocity.set(0, 0, 0);
      let n = 0;
      const bangs = [];
      g.events.on('prop:impact', (p) => {
        if (!p || !p.position || (p.speed || 0) < 4.2) return;
        bangs.push({ at: +(n / 60).toFixed(1), sp: +(p.speed || 0).toFixed(1),
          kind: p.kind || p.type || (p.body && p.body.capyKind) || '?',
          dCapy: +Math.hypot(p.position.x - g.capy.position.x, p.position.z - g.capy.position.z).toFixed(1),
          dRec: +Math.hypot(p.position.x - rec.x, p.position.z - rec.z).toFixed(1) });
      });
      for (n = 0; n < 60 * 180; n++) g.tick(1 / 60, false);
      return { biome: nm, bangs: bangs.slice(0, 20), n: bangs.length,
               blameR: null, famEnd: +(rec.fam || 0).toFixed(2) };
    }, nm));
  }
  await page.evaluate((o) => fetch('/shot?name=o1-bang.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), rows);
}
