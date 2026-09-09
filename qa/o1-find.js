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
  for (const nm of chapters) {
    await page.evaluate(async (nm) => {
      const g = window.__capy;
      if (g.biome.current !== nm) g.biome.switchTo(nm);
      for (let i = 0; i < 40; i++) g.tick(1 / 60, false);
    }, nm);
  }
  const out = await page.evaluate(() => {
    const g = window.__capy;
    return { audit: g.palAudit(), dbg: g.palDebug(), err: g.state.lastError || null };
  });
  await page.evaluate((o) => fetch('/shot?name=o1-find.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
