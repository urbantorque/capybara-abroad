async page => {
  const KEYS = ['Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9',
                'Digit0','Minus','Equal','BracketLeft','BracketRight','Semicolon','Quote',
                'Comma','Period','Slash'];
  const NAMES = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift',
                 'venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic',
                 'monaco','hanoi'];
  const out = [];
  for (let i = 0; i < 19; i++) {
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload();
    await page.waitForTimeout(5200);
    await page.keyboard.press(KEYS[i]);
    await page.waitForTimeout(7000);
    const row = await page.evaluate(async () => {
      const g = window.__capy;
      const c = g.canvas || g.renderer.domElement;
      // The SHOULDER is already a live uniform, so the compression can be
      // measured by sweeping it rather than by adding anything: at 1.0 it is
      // arithmetically the old hard clamp, which is the "no roll-off" arm.
      const P = g.post.params;
      const keep = P.shoulder;
      const shots = [];
      for (const sh of [keep, 1.0]) {
        P.shoulder = sh;
        g.post.render();
        shots.push([sh, c.toDataURL('image/png')]);
      }
      P.shoulder = keep;
      const cv = document.createElement('canvas');
      cv.width = c.width; cv.height = c.height;
      const cx = cv.getContext('2d', { willReadFrequently: true });
      const res = {};
      for (const [sh, url] of shots) {
        const im = new Image();
        await new Promise(r => { im.onload = r; im.src = url; });
        cx.drawImage(im, 0, 0);
        const d = cx.getImageData(0, 0, cv.width, cv.height).data;
        let n = 0, o235 = 0, o248 = 0, o253 = 0, u8 = 0;
        // How many DISTINCT luminance levels the top decile of the picture is
        // spread over. That is the number the ceiling actually costs: a frame
        // whose highlights occupy five levels has no shading in them.
        const seen = new Uint8Array(256);
        const lum = new Uint8Array(cv.width * cv.height);
        let k = 0;
        for (let p = 0; p < d.length; p += 4) {
          const L = (0.2126 * d[p] + 0.7152 * d[p + 1] + 0.0722 * d[p + 2]) | 0;
          lum[k++] = L; n++;
          if (L > 235) o235++;
          if (L > 248) o248++;
          if (L > 253) o253++;
          if (L < 8) u8++;
        }
        // the top decile by value
        const sorted = Array.from(lum).sort((a, b) => a - b);
        const cut = sorted[(sorted.length * 0.90) | 0];
        for (let p = 0; p < lum.length; p++) if (lum[p] >= cut) seen[lum[p]] = 1;
        let levels = 0;
        for (let v = 0; v < 256; v++) if (seen[v]) levels++;
        res[sh === 1.0 ? 'clamp' : 'ship'] = {
          o235: +(100 * o235 / n).toFixed(2),
          o248: +(100 * o248 / n).toFixed(2),
          o253: +(100 * o253 / n).toFixed(2),
          under8: +(100 * u8 / n).toFixed(2),
          topCut: cut, topLevels: levels,
        };
      }
      return { biome: g.biome && g.biome.current, ship: res.ship, clamp: res.clamp,
               err: g.state.lastError || null };
    });
    row.want = NAMES[i];
    out.push(row);
  }
  await page.evaluate(o => fetch('/shot?name=tonehist.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out);
}
