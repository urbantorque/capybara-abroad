async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.reload();
  await wait(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await wait(6500);
  await page.keyboard.press('Digit1');
  await wait(3500);
  const out = {};

  // ---- the two chapters that used to borrow every voice they had ---------
  // 90 s each, because these are the two LONGEST ambience gaps in the game
  // (13-28 s and 15-32 s) and a short sample would say nothing either way.
  for (const b of ['iceland', 'drift']) {
    await page.evaluate(function (n) { window.__capy.biome.switchTo(n); return true; }, b);
    await wait(2500);
    await page.evaluate(() => { window.__capy.hud.ambAudit(true); return true; });
    for (let i = 0; i < 18; i++) await wait(5000);
    out[b] = await page.evaluate(function (n) {
      const a = window.__capy.hud.ambAudit(false);
      return { biome: window.__capy.biome.current, n: a.n, tally: a.tally };
    }, b);
  }

  // ---- the anchors resolve (the api-key trap) ----------------------------
  await page.evaluate(() => { window.__capy.biome.switchTo('iceland'); return true; });
  await wait(2500);
  out.anchors = await page.evaluate(() => {
    const g = window.__capy;
    const ice = g.iceland;
    return { lagoon: ice && ice.lagoon ? { x: ice.lagoon.x, z: ice.lagoon.z } : 'MISSING',
             strokkur: ice && ice.strokkur ? true : 'MISSING',
             crown: g.drift && g.drift.crown ? true : (g.drift ? 'NO CROWN' : 'NO DRIFT') };
  });

  out.err = await page.evaluate(() => window.__capy.state.lastError ? String(window.__capy.state.lastError) : null);
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=f4-place.json', { method: 'POST', body: s }), bl);
}
