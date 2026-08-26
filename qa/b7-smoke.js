async page => {
  // Final smoke on the shipped state: a cold boot, the title card, then every
  // chapter entered in order under a real clock, watching for a thrown update.
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(6000);
  const atTitle = await page.evaluate(() => {
    const g = window.__capy;
    return { started: g.state.started, heat: g.state.heat, heatN: g.state.heatN,
             hasPlace: typeof g.placeHeat === 'function',
             hasForce: typeof g.forceHeat === 'function',
             placeAt00: typeof g.placeHeat === 'function' ? g.placeHeat(0, 0) : null };
  });
  await page.mouse.click(640, 400);
  await page.waitForTimeout(3000);

  const NAMES = await page.evaluate(async () => {
    const src = await (await fetch('/src/shared.js', { cache: 'no-store' })).text();
    const i = src.indexOf('export const CHAPTERS = [');
    const j = src.indexOf('\n];', i);
    const keys = [];
    for (const m of src.slice(i, j).matchAll(/\bbiome:\s*'([a-z]+)'/g)) keys.push(m[1]);
    return keys;
  });

  const rows = [];
  for (const n of NAMES) {
    await page.evaluate((b) => { window.__capy.biome.switchTo(b); }, n);
    await page.waitForTimeout(1600);
    rows.push(await page.evaluate(() => {
      const g = window.__capy;
      return { biome: g.biome.current, heat: +(g.state.heat || 0).toFixed(3),
               sites: g.state.heatN, err: g.state.lastError || null };
    }));
  }
  await page.evaluate((o) => fetch('/shot?name=B7-smoke.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), { atTitle, rows });
}
