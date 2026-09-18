async page => {
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message || e).slice(0, 300)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) });
  const out = { errs, checks: {} };
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://localhost:5188/');
  await page.waitForTimeout(6000);
  await page.evaluate(() => document.querySelector('.capyui-go').click());
  await page.waitForTimeout(3000);

  // ---- Z1: legend has 6 rows now, coin row present ------------------------
  out.checks.legendRows = await page.evaluate(() =>
    document.querySelectorAll('.capyui-mlrow').length);
  out.checks.hasCoinSwatch = await page.evaluate(() =>
    !!document.querySelector('.capyui-mlswatch-coin'));

  // ---- Z2: shop mark radius bigger than before (regression check: shop still draws, no throw) ----
  const mapErr = await page.evaluate(() => {
    try {
      const g = window.__capy;
      // force a redraw by nudging camera-dependent state; just call nothing,
      // mapDraw runs off the rAF loop already. Confirm shopWhere resolves.
      const sw = typeof g.shopWhere === 'function' ? g.shopWhere() : null;
      return { shopWhereType: typeof g.shopWhere, resolved: !!sw };
    } catch (e) { return { err: String(e.message || e) }; }
  });
  out.checks.shopWhere = mapErr;

  // ---- J: spawn a plain yuzu and a golden yuzu near the animal, measure shake/wallet ----
  const jRes = await page.evaluate(() => new Promise((resolve) => {
    const g = window.__capy;
    const before = { shake: g.shakeNow ? g.shakeNow() : null };
    // qaSpawnDrop is the same fixture the L9 probes used
    const rec = g.state.qaSpawnDrop ? g.state.qaSpawnDrop('yuzu') : null;
    if (!rec) { resolve({ fail: 'no qaSpawnDrop' }); return; }
    const p = rec.prop;
    const cp = g.capy.body.position;
    p.body.position.set(cp.x, cp.y + 0.1, cp.z);
    p.body.velocity.set(0, 0, 0);
    const walletBefore = document.querySelector('.capyui-wallet').textContent;
    for (let i = 0; i < 30; i++) g.tick(1 / 60, false);
    const shakeAfterPlain = g.shakeNow ? g.shakeNow() : null;
    const walletAfterPlain = document.querySelector('.capyui-wallet').textContent;
    const bigAfterPlain = document.querySelector('.capyui-wallet').classList.contains('big');
    // now golden
    const rec2 = g.state.qaSpawnDrop('yuzugold');
    const p2 = rec2.prop;
    p2.body.position.set(cp.x, cp.y + 0.1, cp.z);
    p2.body.velocity.set(0, 0, 0);
    for (let i = 0; i < 30; i++) g.tick(1 / 60, false);
    const shakeAfterGolden = g.shakeNow ? g.shakeNow() : null;
    const bigAfterGolden = document.querySelector('.capyui-wallet').classList.contains('big');
    resolve({
      before, walletBefore, walletAfterPlain, bigAfterPlain,
      shakeAfterPlain, shakeAfterGolden, bigAfterGolden,
      err: g.state.lastError || null,
    });
  }));
  out.checks.juice = jRes;

  // ---- calm mode: golden pickup must not add shake -------------------------
  const calmRes = await page.evaluate(() => new Promise((resolve) => {
    const g = window.__capy;
    try { document.documentElement.classList.add('capy-calm'); g.state.calm = true; } catch (e) {}
    if (g.shakeNow) { /* reset not directly possible; just compare delta */ }
    const shakeBefore = g.shakeNow ? g.shakeNow() : null;
    const rec = g.state.qaSpawnDrop('yuzugold');
    const p = rec.prop;
    const cp = g.capy.body.position;
    p.body.position.set(cp.x, cp.y + 0.1, cp.z);
    p.body.velocity.set(0, 0, 0);
    for (let i = 0; i < 30; i++) g.tick(1 / 60, false);
    const shakeAfter = g.shakeNow ? g.shakeNow() : null;
    document.documentElement.classList.remove('capy-calm');
    resolve({ shakeBefore, shakeAfter });
  }));
  out.checks.calm = calmRes;

  await page.screenshot({ path: 'qa/l10-verify-map.png' });
  await page.evaluate(async (o) => { await fetch('/shot?name=l10-verify-jz.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out);
}
