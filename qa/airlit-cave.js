async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5200);
  await page.keyboard.press('Quote');
  await page.waitForTimeout(7000);
  const out = await page.evaluate(async () => {
    const g = window.__capy, T = g.THREE;
    // Find the chapter's own emitters the same way sysSpillScan does, so the
    // probe cannot disagree with the thing it is testing about what a lamp is.
    const found = [];
    const v = new T.Vector3();
    g.scene.traverse(function (o) {
      if (!o.isMesh || !o.visible) return;
      const m = o.material;
      if (!m || !m.emissive) return;
      const ei = m.emissiveIntensity === undefined ? 1 : m.emissiveIntensity;
      const lum = (0.2126 * m.emissive.r + 0.7152 * m.emissive.g + 0.0722 * m.emissive.b) * ei;
      if (lum < 0.10) return;
      if (o.isInstancedMesh) {
        const mt = new T.Matrix4();
        for (let i = 0; i < Math.min(o.count, 400); i++) {
          o.getMatrixAt(i, mt);
          v.setFromMatrixPosition(mt).applyMatrix4(o.matrixWorld);
          if (v.y >= 1.0) found.push({ x: +v.x.toFixed(1), y: +v.y.toFixed(1), z: +v.z.toFixed(1), lum: +lum.toFixed(2) });
        }
      } else {
        v.setFromMatrixPosition(o.matrixWorld);
        if (v.y >= 1.0) found.push({ x: +v.x.toFixed(1), y: +v.y.toFixed(1), z: +v.z.toFixed(1), lum: +lum.toFixed(2) });
      }
    });
    if (!found.length) return { biome: g.biome.current, emitters: 0 };
    // The brightest one, and stand the animal ten metres off it so the pool
    // ranks it in. The pool is written from a live frame, so this has to TICK
    // -- post.render() alone would rank against where the animal used to be.
    found.sort((a, b) => b.lum - a.lum);
    const t = found[0];
    const cp = g.capy.body.position;
    cp.set(t.x + 8, t.y + 1, t.z + 8);
    g.capy.body.previousPosition.copy(cp);
    g.capy.body.interpolatedPosition.copy(cp);
    g.capy.body.velocity.set(0, 0, 0);
    for (let i = 0; i < 90; i++) g.tick(1 / 60, false);
    const c = g.canvas || g.renderer.domElement;
    const P = g.post.params;
    const keep = P.airLight;
    const shots = [];
    for (const [tag, k] of [['off', 0], ['on', keep > 0 ? keep : 0.03]]) {
      P.airLight = k;
      g.post.render();
      shots.push([tag, c.toDataURL('image/png')]);
    }
    P.airLight = keep;
    const cv = document.createElement('canvas');
    cv.width = c.width; cv.height = c.height;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    const px = {};
    for (const [tag, url] of shots) {
      await fetch('/shot?name=AIRCAVE-' + tag, { method: 'POST', body: url });
      const im = new Image();
      await new Promise(r => { im.onload = r; im.src = url; });
      cx.drawImage(im, 0, 0);
      px[tag] = cx.getImageData(0, 0, cv.width, cv.height).data;
    }
    let hit = 0, sum = 0, peak = 0, n = 0;
    for (let i = 0; i < px.off.length; i += 4) {
      const la = 0.2126 * px.off[i] + 0.7152 * px.off[i + 1] + 0.0722 * px.off[i + 2];
      const lb = 0.2126 * px.on[i] + 0.7152 * px.on[i + 1] + 0.0722 * px.on[i + 2];
      n++;
      const dv = lb - la;
      if (dv > 2) { hit++; sum += dv; if (dv > peak) peak = dv; }
    }
    return { biome: g.biome.current, emitters: found.length, target: t,
             capy: [+cp.x.toFixed(1), +cp.y.toFixed(1), +cp.z.toFixed(1)],
             pct: +(100 * hit / n).toFixed(2), mean: hit ? +(sum / hit).toFixed(1) : 0,
             peak: +peak.toFixed(0), err: g.state.lastError || null };
  });
  await page.evaluate(o => fetch('/shot?name=airlitcave.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
