async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5500);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2000);

  const CH = await page.evaluate(async () => {
    const src = await (await fetch('/src/shared.js')).text();
    const rx = /\{\s*id:\s*'([a-z0-9-]+)'\s*,\s*text:\s*'((?:[^'\\]|\\.)*)'([^}]*)\}/g;
    const rows = [];
    let m;
    while ((m = rx.exec(src))) {
      const c = /chapter:\s*(\d+)/.exec(m[3]);
      if (c) rows.push({ id: m[1], text: m[2], ch: +c[1] });
    }
    return rows;
  });

  const BIOMES = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland',
                  'sahara', 'drift', 'venice', 'kowloon', 'palawan', 'goreme',
                  'manly', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi'];

  const rows = [];
  for (let ci = 0; ci < BIOMES.length; ci++) {
    const b = BIOMES[ci];
    const ids = CH.filter(r => r.ch === ci + 1).map(r => r.id);
    // switch, and let the chapter build and settle before anything is asked
    await page.evaluate((name) => { window.__capy.biome.switchTo(name); }, b);
    await page.waitForTimeout(2500);
    const res = [];
    for (let k = 0; k < ids.length; k += 4) {
      const part = await page.evaluate(async (arg) => {
        const g = window.__capy;
        const out = [];
        for (const id of arg.ids) {
          const t = g.hintTarget(id);
          if (!t) { out.push({ id, note: 'no target' }); continue; }
          const hasY = typeof t.y === 'number' && t.y === t.y;
          const bd = g.capy.body;
          // drop from six metres over the target and give it two seconds
          const dropY = (hasY ? t.y : 0) + 6;
          bd.position.set(t.x, dropY, t.z);
          bd.velocity.set(0, 0, 0); bd.angularVelocity.set(0, 0, 0);
          bd.previousPosition.copy(bd.position); bd.interpolatedPosition.copy(bd.position);
          await new Promise(r => setTimeout(r, 2000));
          const s = g.capy.position;
          const v = g.capy.body.velocity;
          out.push({ id,
                     t: [+t.x.toFixed(1), hasY ? +t.y.toFixed(1) : null, +t.z.toFixed(1)],
                     land: [+s.x.toFixed(1), +s.y.toFixed(1), +s.z.toFixed(1)],
                     gap: hasY ? +(t.y - (s.y - 0.34)).toFixed(2) : null,
                     drift: +Math.hypot(s.x - t.x, s.z - t.z).toFixed(1),
                     falling: Math.abs(v.y) > 1.2,
                     grounded: !!g.capy.grounded,
                     swim: !!g.capy.swimming });
        }
        return out;
      }, { ids: ids.slice(k, k + 4) });
      res.push(...part);
    }
    rows.push({ biome: b, ch: ci + 1, rows: res });
  }

  await page.evaluate(async (o) => {
    await fetch('/shot?name=reach2.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, rows);
}
