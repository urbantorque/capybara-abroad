async page => {
  const PICK = [['kowloon','Minus'], ['monaco','Period'], ['iceland','Digit7'], ['cave','Quote']];
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
      const keep = P.airLight;
      // post.render() only, every arm captured before any is decoded, and the
      // camera returned in every row -- the three rules the depth pass paid for.
      const shots = [];
      for (const [tag, v] of [['off', 0], ['on', keep]]) {
        P.airLight = v;
        g.post.render();
        shots.push([tag, c.toDataURL('image/png'),
                    g.camera.position.x, g.camera.position.y, g.camera.position.z]);
      }
      P.airLight = keep;
      const cv = document.createElement('canvas');
      cv.width = c.width; cv.height = c.height;
      const cx = cv.getContext('2d', { willReadFrequently: true });
      const px = {};
      let cam = null;
      for (const [tag, url, x, y, z] of shots) {
        await fetch('/shot?name=AIRLIT-' + tag, { method: 'POST', body: url });
        const im = new Image();
        await new Promise(r => { im.onload = r; im.src = url; });
        cx.drawImage(im, 0, 0);
        px[tag] = cx.getImageData(0, 0, cv.width, cv.height).data;
        cam = [+x.toFixed(4), +y.toFixed(4), +z.toFixed(4)];
      }
      // PER PIXEL, for the reason the leaf term needed it: a glow around four
      // lamps does not move a frame average.
      const a = px.off, b = px.on;
      let hit = 0, sum = 0, peak = 0, n = 0, blown = 0;
      for (let i = 0; i < a.length; i += 4) {
        const la = 0.2126 * a[i] + 0.7152 * a[i + 1] + 0.0722 * a[i + 2];
        const lb = 0.2126 * b[i] + 0.7152 * b[i + 1] + 0.0722 * b[i + 2];
        n++;
        if (lb > 253) blown++;
        const dv = lb - la;
        if (dv > 2) { hit++; sum += dv; if (dv > peak) peak = dv; }
      }
      return { biome: g.biome && g.biome.current, k: keep, spillOn: undefined,
               pct: +(100 * hit / n).toFixed(3), mean: hit ? +(sum / hit).toFixed(2) : 0,
               peak: +peak.toFixed(1), blownOn: +(100 * blown / n).toFixed(3),
               cam: cam, err: g.state.lastError || null };
    });
    row.want = name;
    out.push(row);
  }
  await page.evaluate(o => fetch('/shot?name=airlitab.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
