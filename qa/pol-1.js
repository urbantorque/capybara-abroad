async page => {
  await page.reload();
  await page.waitForTimeout(5000);
  const r = await page.evaluate(() => {
    const g = window.__capy;
    const gl = g.renderer.getContext();
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const x0 = Math.round(w * 0.20), ww = Math.round(w * 0.60);
    const y0 = Math.round(h * 0.08), hh = Math.round(h * 0.30);
    const buf = new Uint8Array(ww * hh * 4);
    let err = null;
    try { g.tick(1 / 60, true); gl.readPixels(x0, y0, ww, hh, gl.RGBA, gl.UNSIGNED_BYTE, buf); }
    catch (e) { err = String(e && e.message || e); }
    let n = 0, s = 0, s2 = 0, clip = 0; const bk = new Set();
    for (let p = 0; p < buf.length; p += 4) {
      const R = buf[p], G = buf[p+1], B = buf[p+2];
      const L = 0.2126*R + 0.7152*G + 0.0722*B;
      n++; s += L; s2 += L*L;
      bk.add(((R>>3)<<10)|((G>>3)<<5)|(B>>3));
      if (R > 250 && G > 250 && B > 250) clip++;
    }
    const mean = s/n;
    return { biome: g.biome && g.biome.current, err,
             lastError: g.state && g.state.lastError ? String(g.state.lastError) : null,
             meanL: +mean.toFixed(1), sd: +Math.sqrt(Math.max(0, s2/n - mean*mean)).toFixed(2),
             cols5bit: bk.size, clipPct: +(100*clip/n).toFixed(2) };
  });
  await page.evaluate((o) => fetch('/shot?name=pol-1.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), r);
}
