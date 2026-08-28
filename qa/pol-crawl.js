async page => {
  const KEYS = [['Digit1','sydney'],['Digit4','kyoto'],['Digit0','venice'],['Equal','palawan'],['Period','monaco']];
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
      // NEAR band: bottom 8-38% of the frame. FAR band: 42-56%, which at this
      // rig is ground from roughly 12 m to the horizon.
      const bands = [[Math.round(h * 0.08), Math.round(h * 0.30)],
                     [Math.round(h * 0.42), Math.round(h * 0.14)]];
      function grab() {
        const o = [];
        for (const [y0, hh] of bands) {
          const b = new Uint8Array(ww * hh * 4);
          gl.readPixels(x0, y0, ww, hh, gl.RGBA, gl.UNSIGNED_BYTE, b);
          o.push(b);
        }
        return o;
      }
      g.tick(1 / 60, true);
      const A = grab();
      // A SUB-PIXEL NUDGE. One centimetre sideways is a fraction of a pixel
      // anywhere past a few metres, so anything that changes materially out
      // there is not the picture moving, it is the field aliasing.
      const cam = g.camera;
      const ox = cam.position.x;
      cam.position.x = ox + 0.06;
      cam.updateMatrixWorld(true);
      g.post.render();
      const B = grab();
      cam.position.x = ox;
      cam.updateMatrixWorld(true);
      g.post.render();
      const res = { want, biome: g.biome && g.biome.current, bands: [] };
      for (let k = 0; k < 2; k++) {
        const a = A[k], b = B[k];
        let n = 0, s = 0, s2 = 0, d2 = 0;
        for (let p = 0; p < a.length; p += 4) {
          const La = 0.2126*a[p] + 0.7152*a[p+1] + 0.0722*a[p+2];
          const Lb = 0.2126*b[p] + 0.7152*b[p+1] + 0.0722*b[p+2];
          n++; s += La; s2 += La*La; d2 += (La-Lb)*(La-Lb);
        }
        const m = s/n, sd = Math.sqrt(Math.max(0, s2/n - m*m)), rms = Math.sqrt(d2/n);
        res.bands.push({ band: k ? 'far' : 'near', meanL: +m.toFixed(1), sd: +sd.toFixed(2),
                         nudgeRMS: +rms.toFixed(3), ratio: +(rms/(sd||1)).toFixed(3) });
      }
      return res;
    }, KEYS[i][1]);
    out.push(r);
  }
  await page.evaluate((o) => fetch('/shot?name=pol-crawl.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
