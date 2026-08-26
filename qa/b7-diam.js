async page => {
  await page.reload();
  await page.waitForTimeout(5500);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(3000);

  const NAMES = await page.evaluate(async () => {
    const src = await (await fetch('/src/shared.js', { cache: 'no-store' })).text();
    const i = src.indexOf('export const CHAPTERS = [');
    if (i < 0) throw new Error('b7-diam: CHAPTERS not found — this audit has gone stale');
    const j = src.indexOf('\n];', i);
    const keys = [];
    for (const m of src.slice(i, j).matchAll(/\bbiome:\s*'([a-z]+)'/g)) keys.push(m[1]);
    if (keys.length < 2) throw new Error('b7-diam: derived ' + keys.length + ' chapters');
    const g = window.__capy;
    for (const k of keys) if (!g.biome[k.toUpperCase() + '_SPAWN']) throw new Error('b7-diam: no spawn for ' + k);
    return keys;
  });

  const out = { _chapters: NAMES.length, rows: [] };
  for (const name of NAMES) {
    const r = await page.evaluate(async (n) => {
      const g = window.__capy;
      g.biome.switchTo(n);
      for (let i = 0; i < 90; i++) g.tick(1 / 60, false);
      const live = g.biome.current;
      if (live !== n) return { biome: n, live, err: 'switch failed' };

      // WHO IS IN THIS CHAPTER. `game.npcs` holds BOTH old casts at once and
      // every chapter shares one coordinate space, so an ungated sweep reports
      // Sydney's park in Antarctica — the first cut of this probe did exactly
      // that and gave nineteen chapters the same 125.2 m span. The two old
      // casts are separated by `kind`, which is the only marker they carry.
      const PA = { vendor: 1, abuela: 1, farmer: 1, churchgoer: 1, llama: 1, streetdog: 1, tourist2: 1 };
      const people = [];
      for (const L of (g.locals || [])) if (L && L.biome === live) people.push([L.x, L.z]);
      if (live === 'sydney' || live === 'pasto') {
        for (const r of (g.npcs || [])) {
          if (!r || !r.group) continue;
          const isPa = !!PA[r.kind];
          if ((live === 'pasto') !== isPa) continue;
          people.push([r.group.position.x, r.group.position.z]);
        }
      }
      const stock = [];
      for (const p of (g.props || [])) {
        if (!p || (p.biome && p.biome !== live)) continue;
        if (typeof p.homeX === 'number' && isFinite(p.homeX)) stock.push([p.homeX, p.homeZ]);
      }

      function span(pts) {
        if (!pts.length) return { n: 0, w: 0, d: 0, diag: 0 };
        let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
        for (const p of pts) {
          if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
          if (p[1] < z0) z0 = p[1]; if (p[1] > z1) z1 = p[1];
        }
        const w = x1 - x0, d = z1 - z0;
        return { n: pts.length, w: +w.toFixed(1), d: +d.toFixed(1), diag: +Math.hypot(w, d).toFixed(1) };
      }
      // The nearest-neighbour spread among the people: the scale at which "the
      // same place" means anything at all in this chapter.
      const nn = [];
      for (let i = 0; i < people.length; i++) {
        let best = 1e9;
        for (let j = 0; j < people.length; j++) {
          if (i === j) continue;
          const dx = people[i][0] - people[j][0], dz = people[i][1] - people[j][1];
          const d2 = dx * dx + dz * dz;
          if (d2 < best) best = d2;
        }
        if (best < 1e8) nn.push(Math.sqrt(best));
      }
      nn.sort((a, b) => a - b);
      return {
        biome: n, live,
        people: span(people), stock: span(stock),
        nnMed: nn.length ? +nn[nn.length >> 1].toFixed(2) : 0,
        nnMax: nn.length ? +nn[nn.length - 1].toFixed(2) : 0,
      };
    }, name);
    out.rows.push(r);
  }

  await page.evaluate((o) => fetch('/shot?name=B7-diam.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
