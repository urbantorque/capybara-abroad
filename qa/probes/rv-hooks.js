async page => {
  await page.reload();
  await page.waitForTimeout(6500);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2000);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const NAMES = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland', 'sahara',
      'drift', 'venice', 'kowloon', 'palawan', 'goreme', 'manly', 'pantanal', 'cave',
      'antarctic', 'monaco', 'hanoi'];
    for (const n of NAMES) { g.biome.switchTo(n); for (let i = 0; i < 40; i++) g.tick(1 / 60, false); }
    g.biome.switchTo('sydney'); for (let i = 0; i < 40; i++) g.tick(1 / 60, false);
    const keys = {};
    for (const n of NAMES) {
      const o = n === 'sydney' ? g.env : g[n];
      keys[n] = o ? Object.keys(o) : [];
    }
    // every name read off a *resolved* biome api in the shared modules
    const asked = new Set();
    for (const f of ['capybara', 'props', 'npc', 'systems', 'condor', 'weather', 'main']) {
      const src = await (await fetch('/src/' + f + '.js', { cache: 'no-store' })).text();
      for (const m of src.matchAll(/\bapi\s*(?:&&\s*api\s*)?\.([A-Za-z_$][\w$]*)/g)) asked.add(m[1]);
      for (const m of src.matchAll(/\b(?:bio|host|A)\s*(?:&&\s*\w+\s*)?\.([A-Za-z_$][\w$]*)/g)) asked.add(m[1]);
    }
    const rows = [];
    for (const name of [...asked].sort()) {
      const has = NAMES.filter(n => keys[n].indexOf(name) >= 0);
      if (has.length === 0 || has.length === NAMES.length) continue;
      rows.push({ hook: name, n: has.length, missing: NAMES.filter(n => has.indexOf(n) < 0) });
    }
    rows.sort((a, b) => b.n - a.n);
    return { rows: rows.filter(r => r.n >= 10) };
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rv-hooks.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
