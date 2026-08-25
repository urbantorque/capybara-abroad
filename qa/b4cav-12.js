async page => {
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 200)));
  await page.addInitScript(() => {
    try { localStorage.clear() } catch (e) {}
    try {
      const c0 = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () {
        if (this.hasAttribute('download')) return; return c0.apply(this, arguments);
      };
    } catch (e) {}
  });
  await page.reload();
  await page.waitForFunction(() => window.__capy && window.__capy.biome, null, { timeout: 30000 });
  await page.keyboard.press('Digit1');
  await page.waitForFunction(() => window.__capy.state.started, null, { timeout: 20000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('cave');
    window.__put = (x, z) => {
      const cav = g.cave, b = g.capy.body;
      b.position.set(x, cav.terrainHeight(x, z) + 0.8, z);
      b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    };
    window.__pp = () => {
      const p = g.post && g.post.params ? g.post.params : (g.post || {});
      const o = {};
      for (const k of ['bloom', 'threshold', 'radius', 'vignette', 'saturation', 'contrast', 'exposure', 'lift'])
        if (typeof p[k] === 'number') o[k] = +p[k].toFixed(3);
      return { keys: Object.keys(p).slice(0, 24), v: o };
    };
  });
  // --- outside the doline zone ---
  await page.evaluate(() => window.__put(4, -80));
  await page.waitForTimeout(4000);
  const outside = await page.evaluate(() => ({ pp: window.__pp(), day: +window.__capy.cave.daylight().toFixed(3),
                                               room: window.__capy.hud.roomAudit() }));
  // --- in the doline, before and after the tick ---
  await page.evaluate(() => window.__put(4, -48));
  await page.waitForTimeout(400);
  const during = await page.evaluate(() => ({ pp: window.__pp(), day: +window.__capy.cave.daylight().toFixed(3) }));
  await page.waitForTimeout(4000);
  const after = await page.evaluate(() => ({ pp: window.__pp(), day: +window.__capy.cave.daylight().toFixed(3),
                                             done: window.__capy.taskDone ? window.__capy.taskDone('the-doline') : null }));
  // --- the loaf, with the game actually started ---
  await page.evaluate(() => { window.__put(0, -80); const g = window.__capy; g.input.x = 0; g.input.z = 0 });
  await page.waitForTimeout(14000);
  const loaf = await page.evaluate(() => {
    const g = window.__capy;
    return { loaf: +(g.capy.loaf || 0).toFixed(3), restT: +(g.capy.restT || 0).toFixed(2),
             stillT: +(g.capy.stillT || 0).toFixed(2), grounded: !!g.capy.grounded,
             started: !!g.state.started, room: g.hud.roomAudit() };
  });
  await page.evaluate(async o => {
    await fetch('/shot?name=b4cav-12.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, { errs, outside, during, after, loaf });
}
