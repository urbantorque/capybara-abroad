async page => {
  const KEYS = [
    ['Digit1', 'sydney'], ['Digit4', 'kyoto'], ['Digit7', 'iceland'],
    ['Digit0', 'venice'], ['Minus', 'kowloon'], ['Equal', 'palawan'],
    ['Period', 'monaco'], ['Slash', 'hanoi'],
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
      function band(fx, fw, fy, fh) {
        const x0 = Math.round(w * fx), ww = Math.round(w * fw);
        const y0 = Math.round(h * fy), hh = Math.round(h * fh);
        const buf = new Uint8Array(ww * hh * 4);
        gl.readPixels(x0, y0, ww, hh, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        let n = 0, s = 0, s2 = 0, clip = 0, sat = 0;
        const bk = new Set();
        for (let p = 0; p < buf.length; p += 4) {
          const R = buf[p], G = buf[p+1], B = buf[p+2];
          const L = 0.2126*R + 0.7152*G + 0.0722*B;
          n++; s += L; s2 += L*L;
          const mx = Math.max(R,G,B), mn = Math.min(R,G,B);
          sat += mx > 0 ? (mx-mn)/mx : 0;
          bk.add(((R>>3)<<10)|((G>>3)<<5)|(B>>3));
          if (R>250&&G>250&&B>250) clip++;
        }
        const mean = s/n;
        return { meanL:+mean.toFixed(1), sd:+Math.sqrt(Math.max(0,s2/n-mean*mean)).toFixed(2),
                 cols:bk.size, clipPct:+(100*clip/n).toFixed(2), sat:+(sat/n).toFixed(3) };
      }
      let err = null, ground = null, sky = null;
      try { g.tick(1/60, true); ground = band(0.20,0.60,0.08,0.30); sky = band(0.10,0.80,0.72,0.26); }
      catch (e) { err = String(e && e.message || e); }
      // scene census
      let pts = 0, spots = 0, meshes = 0, tris = 0;
      g.scene.traverse(o => {
        if (!o.visible) return;
        if (o.isPointLight) pts++;
        if (o.isSpotLight) spots++;
        if (o.isMesh) { meshes++;
          const gg = o.geometry; if (gg) { const idx = gg.index ? gg.index.count : (gg.attributes.position ? gg.attributes.position.count : 0);
            tris += (idx/3) * (o.isInstancedMesh ? o.count : 1); } }
      });
      // frame time
      const t0 = performance.now();
      for (let k = 0; k < 30; k++) g.tick(1/60, true);
      const ft = (performance.now() - t0) / 30;
      const info = g.renderer.info.render;
      return { want, biome: g.biome && g.biome.current, err, ground, sky,
               pts, spots, meshes, tris: Math.round(tris),
               calls: info.calls, ms: +ft.toFixed(2) };
    }, KEYS[i][1]);
    out.push(r);
  }
  await page.evaluate((o) => fetch('/shot?name=na-scan.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
