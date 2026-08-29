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
    for (const arm of ['old', 'new']) {
      const r = await page.evaluate((q) => {
        const g = window.__capy;
        g.state.noBloomRef = (q.arm === 'old');
        g.post.render();
        const cv = g.renderer.domElement;
        const w = cv.width, h = cv.height;
        const c2 = document.createElement('canvas');
        c2.width = w; c2.height = h;
        const cx = c2.getContext('2d');
        cx.drawImage(cv, 0, 0);
        const d = cx.getImageData(0, 0, w, h).data;
        const L = (i) => (d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722) / 255;
        let bi = 0, bl = -1;
        for (let i = 0; i < d.length; i += 4) { const l = L(i); if (l > bl) { bl = l; bi = i / 4; } }
        const bx = bi % w, by = (bi / w) | 0;
        const lv = [0.85, 0.70, 0.60];
        const hit = lv.map(() => -1);
        for (let x = bx; x < w; x++) {
          const l = L((by * w + x) * 4);
          for (let k = 0; k < lv.length; k++) if (hit[k] < 0 && l < lv[k]) hit[k] = (x - bx) / h;
        }
        return { h: h, arm: q.arm, reach: hit.map(v => +v.toFixed(4)) };
      }, { arm });
      out.push(r);
    }
  }
  await page.evaluate(() => { window.__capy.state.noBloomRef = false; });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(async o => { await fetch('/shot?name=lensres3.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out);
}
