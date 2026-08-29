async page => {
  const KEYS = { sydney: 'Digit1', kowloon: 'Minus', monaco: 'Period' };
  const out = [];
  for (const name in KEYS) {
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload();
    await page.waitForTimeout(5200);
    await page.keyboard.press(KEYS[name]);
    await page.waitForTimeout(8000);
    const rows = await page.evaluate(() => {
      const g = window.__capy, s = g.state;
      const gl = g.renderer.getContext();
      const px = new Uint8Array(4);
      // A readPixels forces the driver to finish everything queued, so the
      // wall clock across N composite passes is the composite pass and not
      // the depth of the command queue.
      const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const bench = () => {
        for (let i = 0; i < 20; i++) g.post.render();
        sync();
        const t0 = performance.now();
        for (let i = 0; i < 60; i++) g.post.render();
        sync();
        return (performance.now() - t0) / 60;
      };
      const on = () => { s.noWide = false; s.noSplit = false; s.noShoulder = false; s.noVigTone = false; g.tick(0, false); };
      const off = () => { s.noWide = true; s.noSplit = true; s.noShoulder = true; s.noVigTone = true; g.tick(0, false); };
      const A = [], B = [];
      for (let i = 0; i < 5; i++) { off(); B.push(bench()); on(); A.push(bench()); }
      const md = a => +a.slice().sort((p, q) => p - q)[2].toFixed(3);
      return { onMs: md(A), offMs: md(B), delta: +(md(A) - md(B)).toFixed(3),
               on: A.map(x => +x.toFixed(2)), off: B.map(x => +x.toFixed(2)) };
    });
    out.push({ name, rows });
  }
  await page.evaluate(async o => { await fetch('/shot?name=lensperf2.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out);
}
