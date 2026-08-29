async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5500);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2000);

  // The hint table lives inside the systems.js closure, so the targets are read
  // by pulling the source off the dev server and evaluating each `where` body
  // against the live `game`. Every one of them is `hintObj(<expr>)`.
  const targets = await page.evaluate(async () => {
    const src = await (await fetch('/src/systems.js')).text();
    const rx = /'([a-z0-9-]+)':\s*\{\s*clue:[^}]*?where:\s*function\s*\(\)\s*\{\s*return\s+([\s\S]*?);\s*\}\s*\}/g;
    const out = {};
    let m;
    while ((m = rx.exec(src))) out[m[1]] = m[2];
    return out;
  });

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
    const res = await page.evaluate(async (arg) => {
      const g = window.__capy;
      g.biome.switchTo(arg.b);
      await new Promise(r => setTimeout(r, 1200));
      const out = [];
      for (const id of arg.ids) {
        const expr = arg.T[id];
        if (expr === undefined) { out.push({ id, note: 'no hint row' }); continue; }
        let t = null, err = null;
        try {
          // eslint-disable-next-line no-new-func
          t = new Function('game', 'hintObj', 'return ' + expr + ';')(g, x => x);
        } catch (e) { err = String(e).slice(0, 70); }
        if (err) { out.push({ id, err }); continue; }
        if (!t) { out.push({ id, note: 'null target' }); continue; }
        const p = t.position || t;
        const x = p.x, y = p.y, z = p.z;
        if (typeof x !== 'number' || typeof z !== 'number' || !isFinite(x) || !isFinite(z)) {
          out.push({ id, note: 'target has no usable position' });
          continue;
        }
        // drop the animal onto the target's column and see what it stands on
        const bd = g.capy.body;
        const dropY = (isFinite(y) ? y : 0) + 30;
        bd.position.set(x, dropY, z);
        bd.velocity.set(0, 0, 0); bd.angularVelocity.set(0, 0, 0);
        bd.previousPosition.copy(bd.position); bd.interpolatedPosition.copy(bd.position);
        await new Promise(r => setTimeout(r, 900));
        const s = g.capy.position;
        out.push({ id,
                   t: [+x.toFixed(1), isFinite(y) ? +y.toFixed(1) : null, +z.toFixed(1)],
                   land: [+s.x.toFixed(1), +s.y.toFixed(1), +s.z.toFixed(1)],
                   gap: isFinite(y) ? +(y - (s.y - 0.34)).toFixed(2) : null,
                   drift: +Math.hypot(s.x - x, s.z - z).toFixed(1),
                   swim: !!g.capy.swimming });
      }
      return out;
    }, { b, ids, T: targets });
    rows.push({ biome: b, ch: ci + 1, rows: res });
  }

  await page.evaluate(async (o) => {
    await fetch('/shot?name=reach.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, rows);
}
