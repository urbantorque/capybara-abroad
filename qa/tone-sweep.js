async page => {
  const PICK = [['palawan','Equal'], ['pasto','Digit2']];
  const out = [];
  for (const [name, key] of PICK) {
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload();
    await page.waitForTimeout(5200);
    await page.keyboard.press(key);
    await page.waitForTimeout(7000);
    const row = await page.evaluate(async () => {
      const g = window.__capy;
      const c = g.canvas || g.renderer.domElement;
      const P = g.post.params;
      const keepE = P.exposure, keepS = P.shoulder;
      // TWO CANDIDATE LEVERS, MEASURED AGAINST EACH OTHER. Exposure scales the
      // whole picture before the roll-off; a lower shoulder only touches what
      // is already above the knee and is identity below it. Both widen the top
      // decile; they cost different things elsewhere, and the point of running
      // them side by side is to see WHICH thing.
      const ARMS = [
        ['ship',   1.00, keepS],
        ['e0.92',  0.92, keepS],
        ['e0.86',  0.86, keepS],
        ['e0.80',  0.80, keepS],
        ['e0.74',  0.74, keepS],
        ['sh0.70', 1.00, 0.70],
        ['sh0.58', 1.00, 0.58],
      ];
      const shots = [];
      for (const [tag, e, sh] of ARMS) {
        P.exposure = e; P.shoulder = sh;
        g.post.render();
        shots.push([tag, c.toDataURL('image/png')]);
      }
      P.exposure = keepE; P.shoulder = keepS;
      const cv = document.createElement('canvas');
      cv.width = c.width; cv.height = c.height;
      const cx = cv.getContext('2d', { willReadFrequently: true });
      const rows = [];
      for (const [tag, url] of shots) {
        await fetch('/shot?name=TONE-' + tag, { method: 'POST', body: url });
        const im = new Image();
        await new Promise(r => { im.onload = r; im.src = url; });
        cx.drawImage(im, 0, 0);
        const d = cx.getImageData(0, 0, cv.width, cv.height).data;
        const lum = new Uint8Array(cv.width * cv.height);
        let k = 0, o235 = 0, u8 = 0, sum = 0;
        for (let p = 0; p < d.length; p += 4) {
          const L = (0.2126 * d[p] + 0.7152 * d[p + 1] + 0.0722 * d[p + 2]) | 0;
          lum[k++] = L; sum += L;
          if (L > 235) o235++;
          if (L < 8) u8++;
        }
        const sorted = Array.from(lum).sort((a, b) => a - b);
        const cut = sorted[(sorted.length * 0.90) | 0];
        const seen = new Uint8Array(256);
        for (let p = 0; p < lum.length; p++) if (lum[p] >= cut) seen[lum[p]] = 1;
        let levels = 0;
        for (let v = 0; v < 256; v++) if (seen[v]) levels++;
        rows.push({ tag: tag, o235: +(100 * o235 / k).toFixed(2),
                    under8: +(100 * u8 / k).toFixed(2),
                    mean: +(sum / k).toFixed(1), topLevels: levels });
      }
      return { biome: g.biome && g.biome.current, rows: rows,
               err: g.state.lastError || null };
    });
    row.want = name;
    out.push(row);
  }
  await page.evaluate(o => fetch('/shot?name=tonesweep.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out);
}
