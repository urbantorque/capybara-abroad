async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5200);
  await page.keyboard.press('Period');
  await page.waitForTimeout(8000);
  const out = [];
  for (const s of [[1280, 720], [1920, 1080], [2560, 1440]]) {
    await page.setViewportSize({ width: s[0], height: s[1] });
    await page.waitForTimeout(1600);
    const r = await page.evaluate((sz) => {
      const g = window.__capy;
      g.post.render();
      const cv = g.renderer.domElement;
      const w = cv.width, h = cv.height;
      const c2 = document.createElement('canvas');
      c2.width = w; c2.height = h;
      c2.getContext('2d').drawImage(cv, 0, 0);
      const d = c2.getContext('2d').getImageData(0, 0, w, h).data;
      const L = (i) => (d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722) / 255;
      // brightest pixel = the bulb
      let bi = 0, bl = -1;
      for (let i = 0; i < d.length; i += 4) { const l = L(i); if (l > bl) { bl = l; bi = i / 4; } }
      const bx = bi % w, by = (bi / w) | 0;
      // walk right along the bulb's row and report where the glow crosses
      // each level, in FRACTIONS OF FRAME HEIGHT so the three sizes compare
      const lv = [0.85, 0.60, 0.40, 0.30];
      const hit = lv.map(() => -1);
      for (let x = bx; x < w; x++) {
        const l = L((by * w + x) * 4);
        for (let k = 0; k < lv.length; k++) if (hit[k] < 0 && l < lv[k]) hit[k] = (x - bx) / h;
      }
      return { size: sz, buf: [w, h], bulb: [bx, by], peak: +bl.toFixed(3),
               reach: hit.map(v => +v.toFixed(4)) };
    }, s);
    out.push(r);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(async o => { await fetch('/shot?name=lensres.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out);
}
