async page => {
  await page.goto('http://localhost:5188/', { waitUntil: 'load' });
  await page.waitForTimeout(6500);
  await page.keyboard.press('Space');
  await page.waitForTimeout(3000);

  const CH = ['quay', 'kyoto', 'venice', 'sahara', 'goreme', 'hanoi'];
  const out = [];
  for (const b of CH) {
    await page.evaluate((n) => {
      const g = window.__capy;
      try { g.hud.cross(n); } catch (e) { g.biome.switchTo(n); }
    }, b);
    await page.waitForTimeout(4000);

    const row = await page.evaluate(() => new Promise((res) => {
      const g = window.__capy;
      function rootOf(o) { let r = null; for (let p = o; p; p = p.parent) r = p; return r; }
      function shown(o) { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; }
      const locals = g.locals.filter(r => r.group && rootOf(r.group) === g.scene && shown(r.group));
      const has = locals.filter(r => r.fig && r.fig.legL).length;
      const maxSw = new Array(locals.length).fill(0);
      const anti = new Array(locals.length).fill(0);   // are the two legs in antiphase?
      const moved = new Array(locals.length).fill(0);
      const x0 = locals.map(r => r.x), z0 = locals.map(r => r.z);
      const t0 = performance.now();
      (function step() {
        for (let i = 0; i < locals.length; i++) {
          const r = locals[i];
          if (!r.fig || !r.fig.legL) continue;
          const a = r.fig.legL.rotation.x, b2 = r.fig.legR.rotation.x;
          if (Math.abs(a) > maxSw[i]) maxSw[i] = Math.abs(a);
          if (Math.abs(a) > 0.02 && Math.abs(a + b2) < 1e-6) anti[i] = 1;
          const d = Math.hypot(r.x - x0[i], r.z - z0[i]);
          if (d > moved[i]) moved[i] = d;
        }
        if (performance.now() - t0 < 9000) requestAnimationFrame(step);
        else res({
          biome: g.biome.current, n: locals.length, withLegs: has,
          swung: maxSw.filter(v => v > 0.02).length,
          antiphase: anti.reduce((s, v) => s + v, 0),
          peak: +Math.max(0, ...maxSw).toFixed(3),
          movers: moved.filter(v => v > 0.3).length,
        });
      })();
    }));
    out.push(row);
  }
  await page.evaluate(async (p) => {
    await fetch('/shot?name=BIO-LEGS', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(p)))) });
  }, out);
}
