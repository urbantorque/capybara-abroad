async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(6500);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2500);
  const out = await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('sydney');
    for (let i = 0; i < 150; i++) g.tick(1 / 60, false);
    const drawn = (g.env.cafeTables || []).map(t => [t.x, t.z, t.top]);
    const pat = [];
    for (const r of g.npcs) if (r && r.kind === 'patron')
      pat.push({ state: r.state, table: [+r.tableX.toFixed(2), +r.tableZ.toFixed(2)],
                 seat: [+r.seatX.toFixed(2), +r.seatZ.toFixed(2)] });
    // ...and now stand on the first drawn table and see if anyone notices
    const t = g.env.cafeTables[0], b = g.capy.body;
    b.position.set(t.x, t.top + 0.36, t.z); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    g.input.x = 0; g.input.z = 0;
    for (let i = 0; i < 400; i++) g.tick(1 / 60, false);
    return { drawn, patrons: pat,
             stoodAt: [t.x, t.z], capyY: +g.capy.position.y.toFixed(2),
             cafeTable: !!g.taskDone('cafe-table'),
             lastError: g.state.lastError || null };
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rv-table2.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
