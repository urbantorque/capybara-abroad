async page => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:5188/');
  await page.waitForTimeout(6500);
  const out = [];
  const probe = async (yaw, side, tag) => {
    await page.evaluate(o => { window.__TY = o.y; window.__TS = o.s; }, { y: yaw, s: side });
    await page.waitForTimeout(850);
    const m = await page.evaluate(() => {
      const g = window.__capy;
      const c = g.camera, p = g.capy && g.capy.group ? g.capy.group.position : null;
      let nx = -9, ny = -9;
      if (p) {
        const v = new g.THREE.Vector3(p.x, p.y + 0.5, p.z);
        v.project(c);
        nx = +v.x.toFixed(3); ny = +v.y.toFixed(3);
      }
      const card = document.querySelector('.capyui-card').getBoundingClientRect();
      const W = window.innerWidth, H = window.innerHeight;
      const px = (nx * 0.5 + 0.5) * W, py = (1 - (ny * 0.5 + 0.5)) * H;
      return { nx, ny, px: Math.round(px), py: Math.round(py),
        cardR: Math.round(card.right), cardL: Math.round(card.left),
        clear: px > card.right + 8 || px < card.left - 8,
        onScreen: px > 30 && px < W - 30,
        cam: c.position.toArray().map(v => +v.toFixed(2)) };
    });
    out.push({ tag, yaw: +yaw.toFixed(2), side, ...m });
    await page.screenshot({ path: 'qa/TS-' + tag + '.png' });
  };
  for (const y of [0.35, 0.52, 0.68]) await probe(y, 4.6, 'y' + String(y).replace('.', '_'));
  for (const s of [4.0, 5.2]) await probe(0.52, s, 's' + String(s).replace('.', '_'));
  await page.evaluate(o => fetch('/shot?name=ts.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
