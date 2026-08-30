async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5500);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2500);

  // Tick every wardrobe task first, then walk all nineteen chapters with the
  // costumes live. What is being looked for is the thing a static check cannot
  // see: a costume that throws in a chapter's own update, a material that dies
  // under a different light, or a leak that only shows after nineteen swaps.
  await page.evaluate(() => {
    const g = window.__capy;
    ['steal-hat', 'manly-voyage', 'samba-parade', 'gondola-ride', 'first-dive',
     'sunrise', 'all-the-way', 'the-doline', 'orca-ride', 'black-tie']
      .forEach(t => g.completeTask(t, true));
  });

  const BIOMES = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland',
                  'sahara', 'drift', 'venice', 'kowloon', 'palawan', 'goreme',
                  'manly', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi'];
  const rows = [];
  for (const b of BIOMES) {
    await page.evaluate((n) => {
      const g = window.__capy;
      g.biome.switchTo(n);
      const sp = g.biome.spawnOf(n);
      const bd = g.capy.body;
      bd.position.set(sp.x, sp.y + 0.4, sp.z);
      bd.velocity.set(0, 0, 0);
      bd.previousPosition.copy(bd.position); bd.interpolatedPosition.copy(bd.position);
    }, b);
    await page.waitForTimeout(3200);
    rows.push(await page.evaluate(() => {
      const g = window.__capy, c = g.capy;
      let n = 0;
      c.group.traverse(o => {
        if (!o.isMesh) return;
        let v = o.visible, q = o.parent;
        while (v && q) { v = q.visible; q = q.parent; }
        if (v) n++;
      });
      return { biome: g.biome.current, worn: c.worn, drawn: n,
               err: g.state.lastError || null };
    }));
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=wearsoak.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, rows);
}
