async page => {
  const KEYS = [['Digit1','sydney'],['Minus','kowloon'],['Equal','palawan'],['Comma','cave']];
  const out = [];
  for (let i = 0; i < KEYS.length; i++) {
    await page.reload();
    await page.waitForTimeout(4500);
    await page.keyboard.press(KEYS[i][0]);
    await page.waitForTimeout(6000);
    const d = await page.evaluate((n) => {
      const g = window.__capy;
      g.renderer.setSize(1280, 760, false);
      g.tick(1 / 60, true);
      return { b: g.biome.current, want: n,
               e: g.state.lastError ? String(g.state.lastError) : null,
               err: (g.renderer.info.programs || []).length,
               png: document.querySelector('canvas').toDataURL('image/png') };
    }, KEYS[i][1]);
    out.push({ b: d.b, want: d.want, e: d.e, programs: d.err });
    await page.evaluate(async (a) => { await fetch('/shot?name=pol-rim-' + a[0], { method: 'POST', body: a[1] }); },
                        [KEYS[i][1], d.png]);
  }
  await page.evaluate((o) => fetch('/shot?name=pol-rim.json', { method: 'POST',
    body: btoa(JSON.stringify(o)) }), out);
}
