async page => {
  await page.reload();
  const hook = () => {
    if (window.__err) return;
    window.__err = [];
    const e0 = console.error;
    console.error = function () { window.__err.push([].slice.call(arguments).join(' ')); e0.apply(console, arguments); };
    window.addEventListener('error', ev => window.__err.push('WINDOW ' + (ev.message || ev.error)));
  };
  await page.evaluate(hook);
  await page.waitForFunction(() => window.__capy && window.__capy.biome, null, { timeout: 30000 });
  const keys = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7',
                'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal', 'BracketLeft'];
  const names = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland',
                 'sahara', 'drift', 'venice', 'kowloon', 'palawan', 'goreme',
                 'manly', 'pantanal', 'cave'];
  const out = { worlds: [], errors: [] };
  await page.keyboard.press(keys[0]);
  await page.waitForFunction(() => window.__capy.biome.current === 'sydney', null, { timeout: 30000 });
  for (let i = 0; i < names.length; i++) {
    if (i > 0) {
      await page.evaluate(n => window.__capy.biome.switchTo(n), names[i]);
      await page.evaluate(n => {
        const g = window.__capy;
        const s = g.biome.spawnOf ? g.biome.spawnOf(n) : null;
        if (s && g.capy && g.capy.body) { g.capy.body.position.set(s.x, s.y + 0.4, s.z); g.capy.body.velocity.set(0, 0, 0); }
      }, names[i]);
    }
    await page.waitForTimeout(6000);
    const s = await page.evaluate(() => {
      const g = window.__capy;
      return { biome: g.biome.current, x: +g.capy.position.x.toFixed(1),
               y: +g.capy.position.y.toFixed(1), z: +g.capy.position.z.toFixed(1),
               tris: g.renderer.info.render.triangles, calls: g.renderer.info.render.calls,
               errs: (window.__err || []).length };
    });
    out.worlds.push(s);
  }
  out.errors = await page.evaluate(() => (window.__err || []).slice(0, 25));
  await page.evaluate(async o => {
    await fetch('/shot?name=soak.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
