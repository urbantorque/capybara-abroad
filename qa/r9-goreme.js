async page => {
  // Goreme's ladder line for the burner is gated on `aboard && burner() > 0.4`,
  // so it is unreachable from the ground and ambAudit cannot see it there. The
  // six sites that DO fire in the valley are goreme.js's own, and those go
  // through game.sfx — the object path, not the bed. Hook that instead.
  await page.reload();
  await page.evaluate(() => new Promise(r => setTimeout(r, 4500)));
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.evaluate(() => new Promise(r => setTimeout(r, 6000)));
  await page.keyboard.press('Digit1');
  await page.evaluate(() => new Promise(r => setTimeout(r, 5000)));
  await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('goreme');
    const sp = g.biome.spawnOf('goreme'), cb = g.capy.body;
    if (sp) { cb.position.set(sp.x, sp.y, sp.z); cb.velocity.set(0, 0, 0); }
    window.__heard = {};
    const raw = g.sfx;
    g.sfx = function (n) { window.__heard[n] = (window.__heard[n] || 0) + 1; return raw.apply(g, arguments); };
  });
  await page.evaluate(() => new Promise(r => setTimeout(r, 45000)));
  const out = await page.evaluate(() => {
    const g = window.__capy;
    return { biome: g.biome.current, heard: window.__heard,
             burners: window.__heard.burner || 0,
             err: g.state.lastError ? String(g.state.lastError) : null };
  });
  const b = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=r9-goreme.json', { method: 'POST', body: s }), b);
}
