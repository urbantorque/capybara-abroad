async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) { } });
  await page.goto('http://localhost:5188/index.html');
  await page.waitForTimeout(6000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(3000);
  const out = await page.evaluate(() => {
    const g = window.__capy;
    const keys = Object.keys(g).sort();
    const st = Object.keys(g.state || {}).sort();
    const kp = (g.props || []).filter(p => p.keep).map(p => p.keep);
    return {
      gameKeys: keys,
      stateKeys: st,
      props: (g.props || []).length,
      keeps: kp,
      hasPhys: !!g.phys, physKeys: g.phys ? Object.keys(g.phys).sort() : [],
      biome: g.biome && g.biome.current,
      started: !!(g.state && g.state.started),
      capyKeys: Object.keys(g.capy || {}).sort(),
    };
  });
  await page.evaluate(async o => {
    await fetch('/shot?name=b4fz-0.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out);
}
