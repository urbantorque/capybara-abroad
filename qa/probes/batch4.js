async page => {
  const out = { tag: 'BATCH4' };

  const enter = async (key, want) => {
    await page.reload();
    await page.waitForTimeout(5500);
    await page.keyboard.press(key);
    for (let i = 0; i < 25; i++) {
      await page.waitForTimeout(1000);
      const b = await page.evaluate(() => {
        const g = window.__capy;
        return g && g.biome ? g.biome.current : null;
      });
      if (b === want) { await page.waitForTimeout(2000); return true; }
    }
    return false;
  };

  // ---- A. how much does the HUD write per second, standing still? ---------
  out.sydneyReached = await enter('Digit1', 'sydney');
  await page.evaluate(() => {
    window.__mut = { hud: 0, journal: 0 };
    const hud = document.querySelector('.capyui-root') || document.body;
    const o1 = new MutationObserver(recs => { window.__mut.hud += recs.length; });
    o1.observe(hud, { subtree: true, childList: true, characterData: true, attributes: true });
    window.__obs1 = o1;
  });
  await page.waitForTimeout(4000);
  out.hudMutationsPer4sIdle = await page.evaluate(() => {
    const n = window.__mut.hud;
    window.__mut.hud = 0;
    return n;
  });

  // ---- B. ...and with the journal open ------------------------------------
  await page.keyboard.press('Tab');
  await page.waitForTimeout(1200);
  out.journalOpen = await page.evaluate(() => {
    const g = window.__capy;
    window.__mut.hud = 0;
    return { paused: !!g.state.paused };
  });
  await page.waitForTimeout(4000);
  out.hudMutationsPer4sJournalOpen = await page.evaluate(() => window.__mut.hud);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);

  // ---- C. Venice: how many times a second is the swell re-uploaded? -------
  out.veniceReached = await enter('Digit0', 'venice');
  out.water = await page.evaluate(() => {
    const g = window.__capy;
    const root = g.scene.getObjectByName('venice');
    let attr = null, count = 0;
    if (root) {
      root.traverse(o => {
        if (!o.isMesh || !o.geometry || !o.geometry.attributes) return;
        const pa = o.geometry.attributes.position;
        if (pa && pa.count === 2555 && !attr) { attr = pa; count = pa.count; }
      });
    }
    if (!attr) return { err: 'water mesh not found' };
    const v0 = attr.version;
    for (let i = 0; i < 600; i++) g.tick(1 / 60, false);
    return { verts: count, uploadsPer600Ticks: attr.version - v0 };
  });

  out.soak = await page.evaluate(() => {
    const g = window.__capy;
    let nan = 0;
    for (let c = 0; c < 3; c++) {
      for (let i = 0; i < 400; i++) g.tick(1 / 60, false);
      const p = g.capy && g.capy.position;
      if (p && (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z))) nan++;
    }
    return { biome: g.biome.current, nan: nan, lastError: g.state.lastError || null };
  });

  await page.evaluate(payload => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 1))));
    return fetch('/shot?name=batch4-result.json', { method: 'POST', body: s });
  }, out);
}
