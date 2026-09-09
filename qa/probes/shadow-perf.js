async page => {
  const KEYS = { sydney: 'Digit1', venice: 'Digit0', kyoto: 'Digit4', sahara: 'Digit8' };
  const out = [];
  for (const name in KEYS) {
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload();
    await page.waitForTimeout(5200);
    await page.keyboard.press(KEYS[name]);
    await page.waitForTimeout(8000);
    const r = await page.evaluate(() => {
      const g = window.__capy;
      const gl = g.renderer.getContext();
      const px = new Uint8Array(4);
      const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const bench = () => {
        for (let i = 0; i < 20; i++) g.post.render();
        sync();
        const t0 = performance.now();
        for (let i = 0; i < 60; i++) g.post.render();
        sync();
        return (performance.now() - t0) / 60;
      };
      const a = [];
      for (let i = 0; i < 7; i++) a.push(bench());
      a.sort((p, q) => p - q);
      return { med: +a[3].toFixed(3), lo: +a[0].toFixed(3), hi: +a[6].toFixed(3) };
    });
    out.push({ name: name, r: r });
  }
  await page.evaluate(o => fetch('/shot?name=shadowperf.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out);
}
