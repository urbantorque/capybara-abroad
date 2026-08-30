async page => {
  const PICK = [['kowloon','Minus'], ['monaco','Period'], ['iceland','Digit7'], ['cave','Quote']];
  const KS = [0, 0.02, 0.05, 0.09, 0.15, 0.24];
  const out = [];
  for (const [name, key] of PICK) {
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload();
    await page.waitForTimeout(5200);
    await page.keyboard.press(key);
    await page.waitForTimeout(7000);
    const row = await page.evaluate(async (ks) => {
      const g = window.__capy;
      const c = g.canvas || g.renderer.domElement;
      const P = g.post.params;
      const keep = P.airLight;
      const shots = [];
      for (const k of ks) {
        P.airLight = k;
        g.post.render();
        shots.push([k, c.toDataURL('image/png')]);
      }
      P.airLight = keep;
      const cv = document.createElement('canvas');
      cv.width = c.width; cv.height = c.height;
      const cx = cv.getContext('2d', { willReadFrequently: true });
      const buf = [];
      for (const [k, url] of shots) {
        await fetch('/shot?name=AIRK-' + String(k).replace('.', 'p'),
                    { method: 'POST', body: url });
        const im = new Image();
        await new Promise(r => { im.onload = r; im.src = url; });
        cx.drawImage(im, 0, 0);
        buf.push([k, cx.getImageData(0, 0, cv.width, cv.height).data]);
      }
      const base = buf[0][1];
      const rows = [];
      for (const [k, d] of buf) {
        let hit = 0, sum = 0, peak = 0, n = 0, blown = 0;
        for (let i = 0; i < d.length; i += 4) {
          const la = 0.2126 * base[i] + 0.7152 * base[i + 1] + 0.0722 * base[i + 2];
          const lb = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
          n++;
          if (lb > 253) blown++;
          const dv = lb - la;
          if (dv > 2) { hit++; sum += dv; if (dv > peak) peak = dv; }
        }
        rows.push({ k: k, pct: +(100 * hit / n).toFixed(2),
                    mean: hit ? +(sum / hit).toFixed(1) : 0, peak: +peak.toFixed(0),
                    blown: +(100 * blown / n).toFixed(3) });
      }
      return { biome: g.biome && g.biome.current, rows: rows,
               err: g.state.lastError || null };
    }, KS);
    row.want = name;
    out.push(row);
  }
  await page.evaluate(o => fetch('/shot?name=airlitsweep.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out);
}
