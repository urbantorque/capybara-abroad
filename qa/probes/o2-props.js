async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2000);
  const list = ['quay','kyoto','cali','rio','iceland','sahara','drift','venice','kowloon',
                'palawan','goreme','manly','pantanal','cave','antarctic','monaco','hanoi'];
  const rows = [];
  for (const nm of list) {
    rows.push(await page.evaluate(async (nm) => {
      const g = window.__capy;
      g.biome.switchTo(nm);
      for (let i = 0; i < 90; i++) g.tick(1 / 60, false);
      const f = g.palAudit().found.filter(x => x.b === nm)[0];
      const props = (g.physics && g.physics.all) ? g.physics.all() : null;
      const kinds = {};
      let nearest = [];
      if (props) {
        for (const p of props) {
          if (!p || !p.kind) continue;
          kinds[p.kind] = (kinds[p.kind] || 0) + 1;
          if (f) {
            const d = Math.hypot(p.position.x - f.x, p.position.z - f.z);
            if (d < 14) nearest.push({ k: p.kind, d: +d.toFixed(1) });
          }
        }
      }
      nearest.sort((a, b) => a.d - b.d);
      return { biome: nm, who: f && f.who, kinds, n: props ? props.length : -1,
               nearest: nearest.slice(0, 8) };
    }, nm));
  }
  await page.evaluate((o) => fetch('/shot?name=o2-props.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), rows);
}
