async page => {
  await page.reload();
  await page.waitForTimeout(5200);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(7000);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const s = g.state, c = g.canvas || g.renderer.domElement;
    const rows = [];
    // dt = 0 for every arm, so nothing in the world may step between them and
    // the camera is provably the same camera. Asserted by returning its
    // position in every row.
    const ARMS = [
      ['off',    { noDof: 1, noAir: 1, noCrease: 1 }],
      ['dof',    { noDof: 0, noAir: 1, noCrease: 1 }],
      ['air',    { noDof: 1, noAir: 0, noCrease: 1 }],
      ['crease', { noDof: 1, noAir: 1, noCrease: 0 }],
      ['all',    { noDof: 0, noAir: 0, noCrease: 0 }],
    ];
    for (const [tag, sw] of ARMS) {
      s.noDof = !!sw.noDof; s.noAir = !!sw.noAir; s.noCrease = !!sw.noCrease;
      g.tick(0, true);
      const url = c.toDataURL('image/png');
      await fetch('/shot?name=ISO-' + tag, { method: 'POST', body: url });
      // Mean luminance in three horizontal bands, so a change can be attributed
      // to WHERE it happened instead of being one number for the frame.
      const cv = document.createElement('canvas');
      cv.width = c.width; cv.height = c.height;
      const cx = cv.getContext('2d');
      const im = new Image();
      await new Promise(r => { im.onload = r; im.src = url; });
      cx.drawImage(im, 0, 0);
      const px = cx.getImageData(0, 0, cv.width, cv.height).data;
      const band = [0, 0, 0], bn = [0, 0, 0];
      for (let y = 0; y < cv.height; y += 3) {
        const b = y < cv.height / 3 ? 0 : y < cv.height * 2 / 3 ? 1 : 2;
        for (let x = 0; x < cv.width; x += 3) {
          const i = (y * cv.width + x) * 4;
          band[b] += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
          bn[b]++;
        }
      }
      rows.push({ tag: tag,
        top: +(band[0] / bn[0]).toFixed(2),
        mid: +(band[1] / bn[1]).toFixed(2),
        bot: +(band[2] / bn[2]).toFixed(2),
        cam: [+g.camera.position.x.toFixed(3), +g.camera.position.y.toFixed(3),
              +g.camera.position.z.toFixed(3)] });
    }
    s.noDof = false; s.noAir = false; s.noCrease = false;
    return { biome: g.biome.current, rows: rows, err: s.lastError || null };
  });
  await page.evaluate(o => fetch('/shot?name=depthiso.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
