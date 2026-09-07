async page => {
  await page.reload();
  await page.waitForTimeout(4500);
  const list = await page.evaluate(async () => {
    const g = window.__capy;
    const mod = await import('/src/shared.js');
    return mod.CHAPTERS.map(c => c.biome);
  });
  const rows = [];
  for (const b of list) {
    const r = await page.evaluate(async (bi) => {
      const g = window.__capy;
      try { g.biome.switchTo(bi); } catch (e) { return { biome: bi, err: String(e && e.message) }; }
      for (let i = 0; i < 90; i++) g.tick(1 / 60, false);
      let d = null;
      try { d = g.herdDebug(); } catch (e) { return { biome: bi, err: 'debug ' + String(e && e.message) }; }
      // the animal's own idea of where it is, for the first six of each kind.
      // herdDebug only reports `first`, and the question here is whether the
      // offer's `at` returns DISTINCT, LIVE positions or a seed nothing writes.
      const out = { biome: bi, live: d.biome, kinds: [] };
      for (const k of d.kinds) out.kinds.push(k);
      out.capy = { x: +g.capy.position.x.toFixed(2), y: +g.capy.position.y.toFixed(2),
                   z: +g.capy.position.z.toFixed(2) };
      return out;
    }, b);
    rows.push(r);
  }
  await page.evaluate((o) => fetch('/shot?name=n1-herd-y.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), rows);
}
