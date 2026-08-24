async page => {
  const out = {};
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    window.__qaGo = (name) => {
      const g = window.__capy;
      g.biome.switchTo(name);
      const sp = g.biome.spawnOf(name);
      const b = g.capy.body;
      b.position.set(sp.x, sp.y, sp.z);
      b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position);
      b.interpolatedPosition.copy(b.position);
    };
    window.__qaPut = (x, y, z) => {
      const b = window.__capy.capy.body;
      b.position.set(x, y, z);
      b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position);
      b.interpolatedPosition.copy(b.position);
    };
  });
  // ---- FAM: stand beside somebody and do nothing at all
  await page.evaluate(() => window.__qaGo('goreme'));
  await page.waitForTimeout(1200);
  out.famStart = await page.evaluate(() => {
    const L = (window.__capy.locals || []).filter(r => r.biome === 'goreme');
    const r = L[1];
    window.__qaTarget = r;
    window.__qaPut(r.x + 2.4, r.y + 1.2, r.z + 1.2);
    return { who: r.lines && typeof r.lines[0], fam: r.fam, near: r.near };
  });
  await page.waitForTimeout(26000);
  out.famAfter26 = await page.evaluate(() => ({
    fam: +window.__qaTarget.fam.toFixed(3),
    calm: +window.__capy.state.calm.toFixed(3),
    said: window.__qaTarget.last,
  }));
  out.err = await page.evaluate(() => String(window.__capy.state.lastError));
  await page.evaluate((o) => fetch('/shot?name=w34h.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
