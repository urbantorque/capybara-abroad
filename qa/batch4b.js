async page => {
  const out = { tag: 'BATCH4B' };

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

  const readCard = async () => page.evaluate(() => {
    const sub = document.querySelector('.capyui-jrsub');
    const rows = document.querySelectorAll('.capyui-jrrow');
    let filled = 0;
    rows.forEach(r => { if ((r.textContent || '').trim().length > 3) filled++; });
    return {
      header: sub ? (sub.textContent || '').trim() : null,
      rows: rows.length,
      rowsWithText: filled,
    };
  });

  await enter('Digit1', 'sydney');

  // open, read, close, reopen — the refresh now happens on open, so it has to
  await page.keyboard.press('Tab');
  await page.waitForTimeout(1500);
  out.firstOpen = await readCard();
  await page.waitForTimeout(2500);
  out.afterHolding = await readCard();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(1200);
  out.secondOpen = await readCard();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);

  // ---- Venice: is the swell still actually moving? -----------------------
  await enter('Digit0', 'venice');
  out.swell = await page.evaluate(() => {
    const g = window.__capy;
    const root = g.scene.getObjectByName('venice');
    let attr = null;
    if (root) {
      root.traverse(o => {
        if (!o.isMesh || !o.geometry || !o.geometry.attributes) return;
        const pa = o.geometry.attributes.position;
        if (pa && pa.count === 2555 && !attr) attr = pa;
      });
    }
    if (!attr) return { err: 'no water' };
    const y0 = [];
    for (let i = 0; i < 40; i++) y0.push(attr.getY(i * 7));
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false);
    let moved = 0, maxD = 0;
    for (let i = 0; i < 40; i++) {
      const d = Math.abs(attr.getY(i * 7) - y0[i]);
      if (d > 1e-4) moved++;
      if (d > maxD) maxD = d;
    }
    return { sampled: 40, moved: moved, maxDeltaM: +maxD.toFixed(4) };
  });

  // ---- Hanoi: the beacon still answers away from the lanes ---------------
  await enter('Slash', 'hanoi');
  out.hanoi = await page.evaluate(() => {
    const g = window.__capy;
    const api = g.hanoi;
    const r = {};
    if (!api || typeof api.bike !== 'function') return { err: 'no bike api' };
    const capy = g.capy;
    // out on the lake, far from any lane
    capy.body.position.set(60, 6, 60);
    capy.body.velocity.set(0, 0, 0);
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
    const far = api.bike();
    r.farFromLanes = far ? [+far.x.toFixed(1), +far.z.toFixed(1)] : null;
    r.farOk = !!(far && isFinite(far.x) && isFinite(far.z));
    // and back near the traffic
    capy.body.position.set(0, 3, 0);
    capy.body.velocity.set(0, 0, 0);
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false);
    const near = api.bike();
    r.nearLanes = near ? [+near.x.toFixed(1), +near.z.toFixed(1)] : null;
    r.nearOk = !!(near && isFinite(near.x) && isFinite(near.z));
    r.lastError = g.state.lastError || null;
    return r;
  });

  await page.evaluate(payload => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 1))));
    return fetch('/shot?name=batch4b-result.json', { method: 'POST', body: s });
  }, out);
}
