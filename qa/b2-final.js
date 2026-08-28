async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('BracketRight');     // ch14 Manly
  await page.waitForTimeout(4000);

  const soak = await page.evaluate(async () => {
    const g = window.__capy;
    const r = { live: g.biome.current, chapters: {} };
    for (const nm of ['manly', 'cave']) {
      if (g.biome.current !== nm) g.biome.switchTo(nm);
      for (let i = 0; i < 25; i++) g.tick(1 / 60, false);
      if (g.biome.current !== nm) { r.chapters[nm] = { bad: 'wrong biome' }; continue; }
      const sp = g.biome.spawnOf(nm);
      const b = g.capy.body;
      b.position.set(sp.x, (sp.y || 1) + 0.4, sp.z);
      b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position);
      b.interpolatedPosition.copy(b.position);
      for (let t = 0; t < 1800; t++) g.tick(1 / 60, false);   // 30 s
      const api = nm === 'cave' ? g.cave : g.manly;
      r.chapters[nm] = {
        lastError: g.state.lastError ? String(g.state.lastError).slice(0, 140) : null,
        restY: +b.position.y.toFixed(2),
        // the law must now refuse outside, and answer inside
        lawOutside: (() => { const v = api.terrainHeight(nm === 'manly' ? -70 : 0, nm === 'manly' ? 130 : 200); return (v === v) ? v : 'NaN'; })(),
        lawInside: +api.terrainHeight(sp.x, sp.z).toFixed(2),
      };
    }
    // park it at the old void point for the picture
    if (g.biome.current !== 'manly') g.biome.switchTo('manly');
    for (let i = 0; i < 20; i++) g.tick(1 / 60, false);
    const b = g.capy.body;
    b.position.set(-70, 4, 110);
    b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position);
    b.interpolatedPosition.copy(b.position);
    g.capy.carriedBy = null;
    return r;
  });

  await page.waitForTimeout(3500);          // let the rescue fire and settle
  const after = await page.evaluate(() => {
    const g = window.__capy;
    const b = g.capy.body;
    return {
      live: g.biome.current,
      endedAt: [Math.round(b.position.x), +b.position.y.toFixed(2), Math.round(b.position.z)],
      movedFromVoid: Math.round(Math.hypot(b.position.x - (-70), b.position.z - 110)),
    };
  });

  await page.evaluate(async (o) => {
    await fetch('/shot?name=b2-final.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, { soak, after });
}
