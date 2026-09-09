async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5500);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(3000);
  const out = {};
  // ---- CHAPTER 3: zones now drive the footfall ladder ----------------------
  out.quay = await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('quay');
    for (let i = 0; i < 90; i++) g.tick(1 / 60, false);
    const q = g.quay;
    const probe = (label, x, z) => ({
      at: label, x: x, z: z,
      deck: q.inZone('deck', x, z), corso: q.inZone('corso', x, z),
      manly: q.inZone('manly', x, z), apron: q.inZone('apron', x, z)
    });
    const r = { zones: [], crit: null, err: null };
    // where is Manly, per the chapter itself?
    let mx = 118, mz = -556;
    try { const b = q.manlyAt ? q.manlyAt() : null; if (b) { mx = b.x; mz = b.z; } } catch (e) {}
    r.zones.push(probe('apron', 0, 30));
    r.zones.push(probe('manly beach', mx, mz - 6));
    r.zones.push(probe('corso', mx, mz - 26));
    r.zones.push(probe('open water', 60, -300));
    // the gull critter: does it now carry bold, and does appr move with the loaf?
    const ca = g.hud.calmAudit();
    r.crit = (ca.critters || []).map(c => ({ bold: c.bold, appr: c.appr, near: +(c.near || 0).toFixed(2) }));
    r.err = g.state.lastError ? String(g.state.lastError) : null;
    return r;
  });
  // ---- CHAPTER 2: does it still boot and ring? -----------------------------
  out.pasto = await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('pasto');
    for (let i = 0; i < 90; i++) g.tick(1 / 60, false);
    return { biome: g.biome.current, err: g.state.lastError ? String(g.state.lastError) : null };
  });
  await page.evaluate(o => fetch('/shot?name=pf2-p4verify.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
