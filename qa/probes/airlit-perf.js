async page => {
  const KEYS = { kowloon: 'Minus', monaco: 'Period', iceland: 'Digit7', sydney: 'Digit1' };
  const out = [];
  for (const name in KEYS) {
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload();
    await page.waitForTimeout(5200);
    await page.keyboard.press(KEYS[name]);
    await page.waitForTimeout(8000);
    const rows = await page.evaluate(() => {
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
      const P = g.post.params;
      const keep = P.airLight;
      const md = a => +a.slice().sort((p, q) => p - q)[2].toFixed(3);
      const OFF = [], ON = [];
      // Interleaved, medians of five -- the first arm of every run in this
      // repo measures 5-10% slow.
      for (let i = 0; i < 5; i++) {
        P.airLight = 0;    OFF.push(bench());
        P.airLight = keep; ON.push(bench());
      }
      P.airLight = keep;
      return { k: keep, offMs: md(OFF), onMs: md(ON),
               delta: +(md(ON) - md(OFF)).toFixed(3) };
    });
    out.push({ name: name, rows: rows });
  }
  await page.evaluate(o => fetch('/shot?name=airlitperf.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out);
}
