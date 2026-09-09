async page => {
  await page.reload(); await page.waitForTimeout(5200);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2200);
  const out = {};
  for (const bm of ['sydney', 'pasto']) {
    out[bm] = await page.evaluate(async (name) => {
      const g = window.__capy;
      g.biome.switchTo(name);
      for (let i = 0; i < 90; i++) g.tick(1/60, false);
      const sp = g.biome.spawnOf(name), b = g.capy.body;
      const hold = () => { b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0);
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position); };
      hold();
      const seen = [];
      const grab = () => {
        const els = document.querySelectorAll('div');
        for (const e of els) {
          if (e.style && e.style.borderRadius === '13px' && e.style.display !== 'none') {
            const t = (e.textContent || '').trim();
            if (t && seen.indexOf(t) < 0) seen.push(t);
          }
        }
      };
      for (let i = 0; i < 60 * 200; i++) { hold(); g.tick(1/60, false); if (i % 10 === 0) grab(); }
      return { n: seen.length, lines: seen.slice(0, 70), err: g.state.lastError || null };
    }, bm);
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=z7.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
