async page => {
  const out = await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('sydney');
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false);
    const seated = [];
    for (const r of g.npcs) {
      if (r && r.tableX !== undefined && r.tableZ !== undefined) {
        seated.push({ kind: r.kind, state: r.state,
                      table: [+r.tableX.toFixed(2), +r.tableZ.toFixed(2)],
                      seat: [+(r.seatX || 0).toFixed(2), +(r.seatZ || 0).toFixed(2)] });
      }
    }
    // distinct table positions the diners use
    const tk = {};
    for (const s of seated) tk[s.table[0] + ',' + s.table[1]] = (tk[s.table[0] + ',' + s.table[1]] || 0) + 1;
    // and the tables the chapter actually DRAWS
    const drawn = (g.env.cafeTables || []).map(t => [t.x, t.z, t.top]);
    // nearest drawn table for each diner table
    const near = Object.keys(tk).map(k => {
      const [x, z] = k.split(',').map(Number);
      let best = 1e9, bi = -1;
      drawn.forEach((d, i) => { const e = Math.hypot(d[0] - x, d[1] - z); if (e < best) { best = e; bi = i; } });
      return { dinerTable: [x, z], n: tk[k], nearestDrawn: drawn[bi], dist: +best.toFixed(2) };
    });
    return {
      hasTerraceTables: !!g.env.terraceTables, hasDiningTables: !!g.env.diningTables,
      drawn, seatedN: seated.length, near,
      zoneTerrace: g.env.zones && g.env.zones.terrace,
    };
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rv-table.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
