async page => {
  await page.reload();
  await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const g = window.__capy;
    const log = [];
    const start = g.biome.current;
    for (const n of ['cali', 'venice', 'goreme', 'monaco']) {
      const ok = g.biome.switchTo(n);
      log.push({ ask: n, ok, now: g.biome.current,
                 err: g.state.lastError ? String(g.state.lastError) : null });
      for (let w = 0; w < 30; w++) g.tick(1 / 60, false);
      log[log.length - 1].after = g.biome.current;
    }
    return { start, log };
  });
  await page.evaluate((o) => fetch('/shot?name=pol-why.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), r);
}
