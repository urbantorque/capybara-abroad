async page => {
  await page.reload();
  await page.waitForTimeout(5000);
  const r = await page.evaluate(() => {
    const g = window.__capy;
    const gl = g.renderer.getContext();
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const x0 = Math.round(w * 0.20), ww = Math.round(w * 0.60);
    const buf = new Uint8Array(ww * h * 4);
    g.tick(1 / 60, true);
    gl.readPixels(x0, 0, ww, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    // per 16-row band, from the bottom of the frame upward
    const rows = [];
    for (let b = 0; b < 24; b++) {
      let n = 0, s = 0, s2 = 0;
      for (let y = b * 16; y < b * 16 + 16; y++) {
        for (let x = 0; x < ww; x++) {
          const p = (y * ww + x) * 4;
          const L = 0.2126 * buf[p] + 0.7152 * buf[p + 1] + 0.0722 * buf[p + 2];
          n++; s += L; s2 += L * L;
        }
      }
      const m = s / n;
      rows.push({ y: b * 16, meanL: +m.toFixed(1), sd: +Math.sqrt(Math.max(0, s2 / n - m * m)).toFixed(2) });
    }
    return { biome: g.biome.current, rows };
  });
  await page.evaluate((o) => fetch('/shot?name=pol-3.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), r);
}
