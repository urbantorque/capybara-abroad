async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2000);
  const out = {};
  // A. HOW MANY WARMINGS PER VISIT, counted rather than assumed.
  out.warm = await page.evaluate(async () => {
    const g = window.__capy;
    const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
    const ev = [];
    let leg = '';
    g.events.on('pal:warm', (e) => ev.push({ leg, b: e && e.biome, live: g.biome.current,
                                             chap: g.palDebug().here }));
    const enters = [];
    g.events.on('biome:enter', (e) => enters.push({ leg, name: e && e.name, from: e && e.from }));
    const where = ['goreme', 'venice', 'quay'];
    for (let v = 0; v < 2; v++) {
      for (const nm of where) {
        leg = 'v' + (v + 1) + '/' + nm;
        g.biome.switchTo(nm); tick(40);
        const f = g.palAudit().found.filter(x => x.b === nm)[0];
        const rec = (g.locals || []).filter(l => l.biome === nm &&
          Math.abs(l.x - f.x) < 0.2 && Math.abs(l.z - f.z) < 0.2)[0];
        g.capy.body.position.set(rec.x + 2.3, rec.y + 0.5, rec.z + 0.3);
        g.capy.body.velocity.set(0, 0, 0);
        tick(60 * 45);
      }
    }
    return { ev, enters, tiers: g.palDebug().tiers };
  });
  // B. WHAT OPENS THE LEDGER, and does the leaf carry the line.
  out.leaf = await page.evaluate(async () => {
    const g = window.__capy;
    const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
    const seen = {};
    const probe = () => ({
      lednoto: document.querySelectorAll('.capyui-lednoto').length,
      ledrow: document.querySelectorAll('.capyui-ledrow').length,
      anyLed: document.querySelectorAll('[class*="capyui-led"]').length,
    });
    seen.before = probe();
    for (const code of ['KeyJ', 'KeyL', 'KeyK']) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
      tick(30);
      seen[code] = probe();
      window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
      tick(30);
    }
    // ...and by name, if the HUD publishes one
    const api = Object.keys(g.hud || {});
    return { seen, hudKeys: api };
  });
  await page.evaluate((o) => fetch('/shot?name=o2-diag.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
