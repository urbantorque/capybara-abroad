async page => {
  await page.reload();
  await page.waitForTimeout(6500);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2000);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    // build every chapter so nothing is half-published
    for (const n of ['sydney', 'pasto', 'quay', 'manly', 'kyoto']) {
      g.biome.switchTo(n);
      for (let i = 0; i < 90; i++) g.tick(1 / 60, false);
    }
    g.biome.switchTo('sydney');
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
    const have = {};
    for (const k of ['env', 'pasto', 'quay', 'manly', 'kyoto', 'condor', 'physics', 'hud', 'weather']) {
      const o = g[k];
      have[k] = o ? Object.keys(o).sort() : null;
    }
    // ...and what the source ASKS each of them for
    const files = ['shared', 'environment', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland',
      'sahara', 'drift', 'venice', 'kowloon', 'palawan', 'goreme', 'manly', 'pantanal',
      'cave', 'antarctic', 'monaco', 'hanoi', 'condor', 'capybara', 'props', 'npc', 'systems',
      'weather', 'environment', 'main'];
    const asked = {};
    for (const f of files) {
      let src = '';
      try { src = await (await fetch('/src/' + f + '.js', { cache: 'no-store' })).text(); } catch (e) { continue; }
      for (const key of Object.keys(have)) {
        if (!have[key]) continue;
        const re = new RegExp('game\\.' + key + '\\s*(?:&&\\s*game\\.' + key + '\\s*)?\\.([A-Za-z_$][\\w$]*)', 'g');
        let m;
        while ((m = re.exec(src))) {
          const name = m[1];
          if (have[key].indexOf(name) >= 0) continue;
          asked[key] = asked[key] || {};
          asked[key][name] = asked[key][name] || [];
          if (asked[key][name].indexOf(f) < 0) asked[key][name].push(f);
        }
      }
    }
    return { have: Object.fromEntries(Object.entries(have).map(([k, v]) => [k, v ? v.length : 0])), asked };
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rv-apis.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
