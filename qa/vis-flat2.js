async page => {
  const KEYS = [
    ['Digit1', 'sydney'], ['Digit4', 'kyoto'], ['Digit6', 'rio'],
    ['Digit7', 'iceland'], ['Digit0', 'venice'], ['Minus', 'kowloon'],
    ['Equal', 'palawan'], ['Period', 'monaco'],
  ];
  const out = [];
  for (let i = 0; i < KEYS.length; i++) {
    await page.reload();
    await page.waitForTimeout(4500);
    await page.keyboard.press(KEYS[i][0]);
    await page.waitForTimeout(6000);
    const r = await page.evaluate((want) => {
      const g = window.__capy;
      const gl = g.renderer.getContext();
      const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
      const x0 = Math.round(w * 0.20), ww = Math.round(w * 0.60);
      const y0 = Math.round(h * 0.08), hh = Math.round(h * 0.30);
      const buf = new Uint8Array(ww * hh * 4);
      let err = null;
      try {
        g.tick(1 / 60, true);
        gl.readPixels(x0, y0, ww, hh, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      } catch (e) { err = String(e && e.message || e); }
      let n = 0, s = 0, s2 = 0, clip = 0;
      const bk = new Set();
      for (let p = 0; p < buf.length; p += 4) {
        const R = buf[p], G = buf[p + 1], B = buf[p + 2];
        const L = 0.2126 * R + 0.7152 * G + 0.0722 * B;
        n++; s += L; s2 += L * L;
        bk.add(((R >> 3) << 10) | ((G >> 3) << 5) | (B >> 3));
        if (R > 250 && G > 250 && B > 250) clip++;
      }
      const mean = s / n;
      return {
        want: want, biome: g.biome && g.biome.current, err: err, samples: n,
        meanL: +mean.toFixed(1),
        sd: +Math.sqrt(Math.max(0, s2 / n - mean * mean)).toFixed(2),
        cols5bit: bk.size,
        clipPct: +(100 * clip / n).toFixed(2),
      };
    }, KEYS[i][1]);
    out.push(r);
  }
  await page.evaluate((o) => fetch('/shot?name=vis-flat2.json', {
    method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
