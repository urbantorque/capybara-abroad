async page => {
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    let shots = [];
    try { const o = JSON.parse(localStorage.getItem('capy3.album.v1') || '{}'); shots = o.shots || [] } catch (e) {}
    const lum = u => new Promise(res => {
      const im = new Image();
      im.onload = () => {
        const c = document.createElement('canvas');
        c.width = im.width; c.height = im.height;
        const x = c.getContext('2d');
        x.drawImage(im, 0, 0);
        const d = x.getImageData(0, 0, c.width, c.height).data;
        let s = 0, mx = 0, dark = 0, n = d.length / 4;
        for (let i = 0; i < d.length; i += 4) {
          const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
          s += l; if (l > mx) mx = l; if (l < 16) dark++;
        }
        res({ w: im.width, h: im.height, mean: +(s / n).toFixed(2), max: +mx.toFixed(0), pctUnder16: +(dark / n * 100).toFixed(1) });
      };
      im.onerror = () => res(null);
      im.src = u;
    });
    const r = { n: shots.length, rows: [] };
    for (const s of shots) r.rows.push(await lum(s.u));
    return r;
  });
  await page.evaluate(async o => {
    await fetch('/shot?name=b4cav-3.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, out);
}
