async page => {
  await page.reload();
  await page.waitForTimeout(6500);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2000);
  const out = {};
  for (const arg of [{ n: 'quay', at: [34, 41] }, { n: 'kyoto', at: [-6, 56] }]) {
    out[arg.n] = await page.evaluate((a) => {
      const g = window.__capy;
      g.biome.switchTo(a.n);
      for (let i = 0; i < 150; i++) g.tick(1 / 60, false);
      const list = (g.locals || []).filter(l => l.biome === a.n);
      let best = null, bd = 1e9;
      for (const l of list) { const d = Math.hypot(l.x - a.at[0], l.z - a.at[1]); if (d < bd) { bd = d; best = l; } }
      if (!best) return { none: true };
      const keys = Object.keys(best);
      const dump = {};
      for (const k of keys) {
        const v = best[k];
        if (typeof v === 'function') { dump[k] = 'fn'; continue; }
        if (v && typeof v === 'object') {
          if (Array.isArray(v)) dump[k] = v.length + ' items: ' + JSON.stringify(v).slice(0, 400);
          else dump[k] = 'obj';
          continue;
        }
        dump[k] = v;
      }
      return { d: +bd.toFixed(2), dump: dump };
    }, arg);
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rv-silent.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
