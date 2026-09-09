async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);
  const src = await (await page.request.get('http://localhost:5188/src/shared.js')).text();
  const chapters = [];
  const re = /\{\s*n:\s*(\d+),\s*biome:\s*'([a-z]+)'/g;
  let m; while ((m = re.exec(src))) chapters.push(m[2]);
  const rows = [];
  for (const nm of chapters) {
    rows.push(await page.evaluate(async (nm) => {
      const g = window.__capy;
      if (g.biome.current !== nm) g.biome.switchTo(nm);
      for (let i = 0; i < 40; i++) g.tick(1 / 60, false);
      const sp = g.biome.spawnOf(nm);
      const L = (g.locals || []).filter(l => l.biome === nm);
      return { biome: nm, people: L.map((l, i) => ({
        i, d: +Math.hypot(l.x - sp.x, l.z - sp.z).toFixed(1),
        beat: l.beat ? (l.beat.kind || l.beat.name || JSON.stringify(l.beat).slice(0, 40)) : null,
        keys: Object.keys(l.says || {}).filter(k => l.says[k]),
        lines: l.lines ? l.lines.length : 0, first: l.lines ? l.lines[0] : null,
        tool: l.tool ? 1 : 0, gd: !!l.gd, fig: !!l.fig,
      })).sort((a, b) => a.d - b.d) };
    }, nm));
  }
  await page.evaluate((o) => fetch('/shot?name=o1-who.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), rows);
}
