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
    const r = await page.evaluate(() => {
      const g = window.__capy;
      const cv = g.renderer.domElement;
      const grab = () => {
        g.post.render();
        const w = cv.width, h = cv.height;
        const c2 = document.createElement('canvas');
        c2.width = w; c2.height = h;
        const cx = c2.getContext('2d');
        cx.drawImage(cv, 0, 0);
        return { w, h, d: cx.getImageData(0, 0, w, h).data };
      };
      // The lamp, once, from the arm that is on now.
      g.state.noBloomRef = false;
      let f = grab();
      const L = (d, i) => (d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722) / 255;
      let bi = 0, bl = -1;
      for (let i = 0; i < f.d.length; i += 4) { const l = L(f.d, i); if (l > bl) { bl = l; bi = i / 4; } }
      const bx = bi % f.w, by = (bi / f.w) | 0, H = f.h;
      // Mean luminance in an annulus 0.10..0.20 of frame HEIGHT out from the
      // bulb — well clear of the bulb itself, which is what the last probe
      // was accidentally measuring. Same fractions at every resolution, so a
      // halo that is a fixed piece of the picture reads the same number.
      const ring = (d, w, h) => {
        const r0 = 0.10 * H, r1 = 0.20 * H, r1s = r1 * r1, r0s = r0 * r0;
        let sum = 0, n = 0;
        const y0 = Math.max(0, by - r1 | 0), y1 = Math.min(h - 1, by + r1 | 0);
        const x0 = Math.max(0, bx - r1 | 0), x1 = Math.min(w - 1, bx + r1 | 0);
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          const dd = (x - bx) * (x - bx) + (y - by) * (y - by);
          if (dd < r0s || dd > r1s) continue;
          sum += L(d, (y * w + x) * 4); n++;
        }
        return n ? sum / n : 0;
      };
      const New = ring(f.d, f.w, f.h);
      g.state.noBloomRef = true;
      f = grab();
      const Old = ring(f.d, f.w, f.h);
      g.state.noBloomRef = false;
      return { h: H, bulb: [bx, by], newRing: +New.toFixed(4), oldRing: +Old.toFixed(4) };
    });
    out.push(r);
  }
  await page.evaluate(() => { window.__capy.state.noBloomRef = false; });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(async o => { await fetch('/shot?name=lensres4.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out);
}
