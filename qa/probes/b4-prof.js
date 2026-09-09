async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(3000);
  const out = await page.evaluate(async () => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    const g = window.__capy;
    const res = {};
    const SITES = [['monaco', -11.8, -105.6], ['pasto', 113.2, 56.8], ['goreme', 94, 20], ['cali', -68, -69]];
    for (const [nm, x0, z0] of SITES) {
      if (g.biome.current !== nm) { g.biome.switchTo(nm); await sleep(900); }
      for (let i = 0; i < 20; i++) g.tick(1 / 60, false);
      const api = g[nm];
      const th = (x, z) => { const v = api.terrainHeight(x, z); return (typeof v === 'number' && v === v) ? +v.toFixed(3) : null; };
      const h0 = th(x0, z0);
      const px = [], pz = [];
      for (let k = -8; k <= 8; k++) {
        px.push(+(th(x0 + k * 0.15, z0) - h0).toFixed(3));
        pz.push(+(th(x0, z0 + k * 0.15) - h0).toFixed(3));
      }
      // gradient magnitude as a function of the baseline it is measured over
      const g_by = {};
      for (const L of [0.15, 0.30, 0.45, 0.60, 0.90, 1.20, 2.00]) {
        const gx = (th(x0 + L, z0) - th(x0 - L, z0)) / (2 * L);
        const gz = (th(x0, z0 + L) - th(x0, z0 - L)) / (2 * L);
        g_by[L] = +Math.sqrt(gx * gx + gz * gz).toFixed(3);
      }
      res[nm] = { at: [x0, z0], h0: h0, dx: px, dz: pz, gradByBaseline: g_by };
    }
    return res;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b4-prof.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);
}
