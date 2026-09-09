async page => {
  const out = { errs: [] };
  page.on('console', m => { if (m.type() === 'error') out.errs.push(m.text().slice(0, 200)); });
  await page.reload();
  await page.waitForTimeout(4500);
  await page.mouse.click(640, 400);
  await page.keyboard.press('Space');
  await page.waitForTimeout(1200);
  const boot = await page.evaluate(() => {
    const g = window.__capy;
    return { started: g.state.started, biome: g.biome.current, weather: !!g.weather };
  });
  out.boot = boot;
  await page.waitForTimeout(4000);
  const a = await page.evaluate(() => {
    const g = window.__capy;
    const h = g.hud || {};
    return { probe: typeof h.audioProbe === 'function' ? h.audioProbe(0, 0, 0) : null };
  });
  out.probe = a.probe;
  await page.evaluate(() => {
    const g = window.__capy, W = g.weather;
    const b = W.rowOf(g.biome.current);
    W.set(g.biome.current, { rain: { odds: 1, peak: 0.7, hold: 70, gap: 1 } });
  });
  await page.waitForTimeout(20000);
  const mid = await page.evaluate(() => {
    const g = window.__capy, W = g.weather;
    return { rain: +W.drizzle().toFixed(2), wet: +W.wetness().toFixed(2),
             bed: W.bed(), lastError: g.state.lastError || null,
             ctx: (window.AudioContext ? 'yes' : 'no') };
  });
  out.mid = mid;
  await page.evaluate(() => { window.__capy.sfx('thunder', { volume: 0.6 }); });
  await page.waitForTimeout(5000);
  await page.evaluate(() => { window.__capy.sfx('drip', { volume: 0.6 }); });
  await page.waitForTimeout(2000);
  const end = await page.evaluate(() => ({ lastError: window.__capy.state.lastError || null,
                                           time: +window.__capy.state.time.toFixed(1) }));
  out.end = end;
  await page.evaluate(o => fetch('/shot?name=wx-audio-result.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out);
}
