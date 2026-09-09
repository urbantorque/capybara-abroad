async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);

  const src = await (await page.request.get('http://localhost:5188/src/shared.js')).text();
  const chapters = [];
  const re = /\{\s*n:\s*(\d+),\s*biome:\s*'([a-z]+)'/g;
  let m;
  while ((m = re.exec(src))) chapters.push(m[2]);

  const rows = [];
  for (const nm of chapters) {
    const row = await page.evaluate(async (nm) => {
      const g = window.__capy;
      if (g.biome.current !== nm) g.biome.switchTo(nm);
      for (let i = 0; i < 40; i++) g.tick(1 / 60, false);
      const sp = g.biome.spawnOf(nm);
      const L = (g.locals || []).filter(l => l.biome === nm);
      const near = L.map(l => ({
        kind: l.kind || l.k || '?', name: l.name || null,
        d: +Math.hypot(l.x - sp.x, l.z - sp.z).toFixed(1),
        fig: !!l.fig, beat: l.beat || null, gd: !!l.gd,
      })).sort((a, b) => a.d - b.d);
      // Sydney/Pasto steering cast: how many PEOPLE near the spawn
      const cast = g.npcs && (nm === 'sydney' ? g.npcs.humans : nm === 'pasto' ? g.npcs.pastoHumans : null);
      let castNear = null;
      if (cast) {
        castNear = cast.filter(h => h && h.group)
          .map(h => +Math.hypot(h.group.position.x - sp.x, h.group.position.z - sp.z).toFixed(1))
          .sort((a, b) => a - b).slice(0, 4);
      }
      return { biome: nm, live: g.biome.current, spawn: [sp.x, sp.z],
               n: L.length, nearest: near.slice(0, 5), castNear,
               within12: near.filter(x => x.d <= 12).length,
               within20: near.filter(x => x.d <= 20).length };
    }, nm);
    rows.push(row);
  }
  await page.evaluate((o) => fetch('/shot?name=o1-earshot.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), rows);
}
