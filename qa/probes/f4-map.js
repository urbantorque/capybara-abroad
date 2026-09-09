async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await wait(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await wait(6500);
  await page.keyboard.press('Digit1');
  await wait(5000);
  const shots = [];
  // Four charts with very different door positions and label lengths: Sydney
  // ('the ferry wharf'), the Quay ('up the Corso', the longest world), Venice
  // ('the two columns') and the cave, whose door was the only one that ever
  // existed before every chart got one.
  for (const b of ['sydney', 'quay', 'venice', 'cave']) {
    await page.evaluate(function (n) { window.__capy.biome.switchTo(n); return true; }, n = b);
    await wait(3200);
    const box = await page.evaluate(() => {
      const el = document.querySelector('.capyui-map');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cv = el.querySelector('canvas');
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
               cw: cv ? cv.width : -1, vis: getComputedStyle(el).opacity };
    });
    if (box && box.w > 0) {
      await page.screenshot({ path: 'qa/F4-map-' + b + '.png',
                              clip: { x: box.x - 6, y: box.y - 6, width: box.w + 12, height: box.h + 12 } });
    }
    shots.push({ biome: b, box: box,
                 way: await page.evaluate(() => {
                   const a = window.__capy.hud.mapMarkAudit();
                   return { biome: a.biome, missing: a.missing,
                            wayOk: a.ok.filter(s => s.indexOf('WAY OUT') === 0) };
                 }) });
  }
  const out = { shots, err: await page.evaluate(() => window.__capy.state.lastError ? String(window.__capy.state.lastError) : null) };
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=f4-map.json', { method: 'POST', body: s }), bl);
}
