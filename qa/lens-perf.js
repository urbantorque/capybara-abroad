async page => {
  const KEYS = { sydney: 'Digit1', kowloon: 'Minus', monaco: 'Period', cave: 'Quote' };
  const out = [];
  for (const name in KEYS) {
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload();
    await page.waitForTimeout(5200);
    await page.keyboard.press(KEYS[name]);
    await page.waitForTimeout(8000);
    const rows = await page.evaluate(async () => {
      const g = window.__capy;
      const s = g.state;
      const bench = () => new Promise(res => {
        let n = 0; const ts = [];
        const step = () => {
          const t0 = performance.now();
          requestAnimationFrame(() => {
            const dt = performance.now() - t0;
            n++; if (n > 30) ts.push(dt);
            if (n < 181) step(); else {
              ts.sort((a, b) => a - b);
              res({ med: +ts[Math.floor(ts.length / 2)].toFixed(3),
                    p95: +ts[Math.floor(ts.length * 0.95)].toFixed(3) });
            }
          });
        };
        step();
      });
      const on = () => { s.noWide = false; s.noSplit = false; s.noShoulder = false; s.noVigTone = false; };
      const off = () => { s.noWide = true; s.noSplit = true; s.noShoulder = true; s.noVigTone = true; };
      const A = [], B = [];
      for (let i = 0; i < 3; i++) { off(); B.push(await bench()); on(); A.push(await bench()); }
      const med = a => a.map(x => x.med).sort((p, q) => p - q)[1];
      const p95 = a => a.map(x => x.p95).sort((p, q) => p - q)[1];
      return { on: { med: med(A), p95: p95(A) }, off: { med: med(B), p95: p95(B) },
               arms: { on: A, off: B } };
    });
    out.push({ name, rows });
  }
  await page.evaluate(async o => { await fetch('/shot?name=lensperf.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out);
}
