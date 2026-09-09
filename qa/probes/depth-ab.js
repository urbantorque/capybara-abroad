async page => {
  await page.reload();
  await page.waitForTimeout(5200);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(7000);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const c = g.canvas || g.renderer.domElement;
    const P = g.post.params;
    // THE ONLY HONEST A/B AVAILABLE HERE. game.tick() steps the world and the
    // camera even at dt = 0 — measured, the camera moved 0.09 m over five arms
    // of the previous probe — so nothing that calls tick() can isolate a term.
    // post.render() re-renders the SAME scene through the SAME camera and does
    // nothing else, and sysDressFrame cannot overwrite the params because it
    // never runs. Asserted by returning the camera in every row.
    const keep = { dof: P.dof, air: P.air, crease: P.crease };
    const ARMS = [
      ['off',    { dof: 0,        air: 0,        crease: 0 }],
      ['dof',    { dof: keep.dof, air: 0,        crease: 0 }],
      ['air',    { dof: 0,        air: keep.air, crease: 0 }],
      ['crease', { dof: 0,        air: 0,        crease: keep.crease }],
      ['all',    { dof: keep.dof, air: keep.air, crease: keep.crease }],
    ];
    const cv = document.createElement('canvas');
    cv.width = c.width; cv.height = c.height;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    const W = cv.width, H = cv.height;
    // Bands by ROW, and one patch that is known flat ground: the lower centre
    // of a Sydney arrival frame is lawn, and a flat plane must take no
    // occlusion at all. That patch is the whole reason the paired-tap form of
    // mainCrease exists, so it is the thing the probe has to be able to see.
    const GX0 = (W * 0.06) | 0, GX1 = (W * 0.34) | 0;
    const GY0 = (H * 0.74) | 0, GY1 = (H * 0.96) | 0;
    const rows = [];
    // EVERY ARM IS CAPTURED BEFORE ANY OF THEM IS DECODED. The previous
    // version awaited an Image load inside the loop, and an await yields to
    // the event loop, and the event loop is where rAF lives — so the real game
    // stepped between arms and the camera walked 0.16 m across five of them.
    // toDataURL is synchronous; taking all five and decoding afterwards is the
    // difference between an A/B and five different photographs.
    const shots = [];
    for (const [tag, sw] of ARMS) {
      P.dof = sw.dof; P.air = sw.air; P.crease = sw.crease;
      g.post.render();
      shots.push([tag, c.toDataURL('image/png'),
                  g.camera.position.x, g.camera.position.y, g.camera.position.z]);
    }
    P.dof = keep.dof; P.air = keep.air; P.crease = keep.crease;
    for (const [tag, url, cxp, cyp, czp] of shots) {
      await fetch('/shot?name=AB-' + tag, { method: 'POST', body: url });
      const im = new Image();
      await new Promise(r => { im.onload = r; im.src = url; });
      cx.drawImage(im, 0, 0);
      const px = cx.getImageData(0, 0, W, H).data;
      const L = new Float32Array(W * H);
      const C = new Float32Array(W * H);
      for (let i = 0, j = 0; j < W * H; i += 4, j++) {
        L[j] = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
        // CHROMA, max channel minus min. The air term is a mix toward one
        // colour and therefore spends SATURATION, which is the currency the
        // first table overdrew: Sydney's harbour went grey-green and the
        // luminance metric could not see it happen because a mix toward a pale
        // haze RAISES the mean. This is the number that has to be watched.
        const mx = Math.max(px[i], px[i + 1], px[i + 2]);
        const mn = Math.min(px[i], px[i + 1], px[i + 2]);
        C[j] = mx - mn;
      }
      const mean = [0, 0, 0], sharp = [0, 0, 0], chr = [0, 0, 0], n = [0, 0, 0];
      for (let y = 1; y < H - 1; y++) {
        const b = y < H / 3 ? 0 : y < H * 2 / 3 ? 1 : 2;
        for (let x = 1; x < W - 1; x++) {
          const j = y * W + x;
          mean[b] += L[j];
          chr[b] += C[j];
          // GRADIENT ENERGY, which is what a defocus actually changes. A blur
          // preserves mean luminance almost exactly, so the previous probe's
          // "dof moves the frame by 0.14 of 255" was measuring nothing at all
          // — correctly, and about the wrong quantity.
          sharp[b] += Math.abs(L[j + 1] - L[j]) + Math.abs(L[j + W] - L[j]);
          n[b]++;
        }
      }
      let gsum = 0, gn = 0;
      for (let y = GY0; y < GY1; y++) {
        for (let x = GX0; x < GX1; x++) { gsum += L[y * W + x]; gn++; }
      }
      rows.push({ tag: tag,
        meanTop: +(mean[0] / n[0]).toFixed(2),
        meanMid: +(mean[1] / n[1]).toFixed(2),
        meanBot: +(mean[2] / n[2]).toFixed(2),
        shTop: +(sharp[0] / n[0]).toFixed(3),
        shMid: +(sharp[1] / n[1]).toFixed(3),
        shBot: +(sharp[2] / n[2]).toFixed(3),
        chTop: +(chr[0] / n[0]).toFixed(2),
        chMid: +(chr[1] / n[1]).toFixed(2),
        lawn: +(gsum / gn).toFixed(3),
        cam: [+cxp.toFixed(4), +cyp.toFixed(4), +czp.toFixed(4)] });
    }
    return { biome: g.biome.current, size: [W, H], rows: rows,
             err: g.state.lastError || null };
  });
  await page.evaluate(o => fetch('/shot?name=depthab.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
