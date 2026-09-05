async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.reload();
  await wait(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await wait(6500);
  await page.keyboard.press('Digit1');
  await wait(3500);
  await page.evaluate(() => {
    const g = window.__capy;
    try { g.hud.cross('rio'); } catch (e) { g.biome.switchTo('rio'); }
    return true;
  });
  await wait(9000);
  // Sample the beat clock across more than a full 16-bar phrase (0.909 s a bar
  // => ~14.5 s) and check it never stalls, reverses or skips through the break.
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const rows = [];
    const t0 = performance.now();
    for (let i = 0; i < 90; i++) {
      const m = g.musAudit();
      let beats = null;
      try { beats = g.music && typeof g.music.beats === 'function' ? g.music.beats() : null; } catch (e) { beats = 'THREW'; }
      rows.push({ t: +((performance.now() - t0) / 1000).toFixed(2), bar: m.bar,
                  beats: typeof beats === 'number' ? +beats.toFixed(3) : beats,
                  drum: m.drum, band: m.band });
      await new Promise(r => setTimeout(r, 200));
    }
    return rows;
  });
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), { out });
  await page.evaluate(s => fetch('/shot?name=f3-beat.json', { method: 'POST', body: s }), bl);
}
