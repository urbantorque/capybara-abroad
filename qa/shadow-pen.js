async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5200);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(7000);
  const out = await page.evaluate(async () => {
    const g = window.__capy, T = g.THREE;
    const c = g.canvas || g.renderer.domElement;
    const sun = g.scene.children.find(o => o.isDirectionalLight && o.castShadow);
    const P = g.post.params;
    // THE LENS COMES OFF. The defocus blurs the very edge under test, and the
    // first version of this probe measured the depth of field and reported a
    // 1279-pixel penumbra -- i.e. the whole scanline.
    const keep = { dof: P.dof, air: P.air, crease: P.crease, vig: P.vignette,
                   con: P.contrast, bloom: P.bloom };
    P.dof = 0; P.air = 0; P.crease = 0; P.vignette = 0; P.contrast = 0; P.bloom = 0;
    // NO EDGE DETECTOR. Three attempts at measuring a transition width off a
    // rendered frame failed for the same reason each time: a Sydney lawn has
    // benches, tufts, jacaranda decals and a capybara on it, and every one of
    // those is a steeper luminance step than a penumbra. The prediction does
    // not need a width -- it is simply that the two filters AGREE for a caster
    // on the ground and DIVERGE as it rises. A per-pixel diff between the arms
    // tests exactly that and cannot be fooled by clutter, because the clutter
    // is identical in both arms.
    const cp = g.capy.position;
    const box = new T.Mesh(new T.BoxGeometry(4, 0.3, 4),
                           new T.MeshLambertMaterial({ color: 0x555555 }));
    box.castShadow = true; box.receiveShadow = false;
    g.scene.add(box);
    const dir = sun.position.clone().sub(sun.target.position).normalize();
    const cam = g.camera;
    const keepPos = cam.position.clone(), keepQ = cam.quaternion.clone();
    const cv = document.createElement('canvas');
    cv.width = c.width; cv.height = c.height;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    function grab() { g.post.render(); return c.toDataURL('image/png'); }
    async function decode(url) {
      const im = new Image();
      await new Promise(r => { im.onload = r; im.src = url; });
      cx.drawImage(im, 0, 0);
      return cx.getImageData(0, 0, cv.width, cv.height).data;
    }
    const HEIGHTS = [0.25, 1.0, 3.0, 8.0];
    const keepR = sun.shadow.radius;
    const shots = [];
    for (const h of HEIGHTS) {
      const bx = cp.x + 2, bz = cp.z + 2;
      box.position.set(bx, cp.y + h, bz);
      box.updateMatrixWorld(true);
      const t = h / Math.max(dir.y, 0.05);
      const sx = bx - dir.x * t, sz = bz - dir.z * t;
      cam.position.set(sx, cp.y + 9, sz);
      cam.up.set(0, 0, -1);
      cam.lookAt(sx, cp.y - 0.2, sz);
      cam.updateMatrixWorld(true);
      // shadowRadius 0 clamps the derived radius to its one-texel floor, which
      // IS the fixed-kernel behaviour this replaced -- a faithful stand-in for
      // the old filter without reverting three's chunk.
      sun.shadow.radius = 0;     sun.shadow.needsUpdate = true;
      const a = grab();
      sun.shadow.radius = keepR; sun.shadow.needsUpdate = true;
      const b = grab();
      shots.push([h, a, b]);
    }
    const rows = [];
    for (const [h, ua, ub] of shots) {
      const a = await decode(ua), b = await decode(ub);
      let hit = 0, sum = 0, n = 0, peak = 0;
      for (let i = 0; i < a.length; i += 4) {
        const la = 0.2126 * a[i] + 0.7152 * a[i + 1] + 0.0722 * a[i + 2];
        const lb = 0.2126 * b[i] + 0.7152 * b[i + 1] + 0.0722 * b[i + 2];
        n++;
        const d = Math.abs(lb - la);
        if (d > 2) { hit++; sum += d; if (d > peak) peak = d; }
      }
      rows.push({ h: h, pct: +(100 * hit / n).toFixed(3),
                  mean: hit ? +(sum / hit).toFixed(1) : 0, peak: +peak.toFixed(0) });
      if (h === 8.0) {
        await fetch('/shot?name=PEN-fixed', { method: 'POST', body: ua });
        await fetch('/shot?name=PEN-contact', { method: 'POST', body: ub });
      }
    }
    sun.shadow.radius = keepR;
    g.scene.remove(box);
    box.geometry.dispose(); box.material.dispose();
    cam.up.set(0, 1, 0);
    cam.position.copy(keepPos); cam.quaternion.copy(keepQ);
    cam.updateMatrixWorld(true);
    sun.shadow.needsUpdate = true;
    P.dof = keep.dof; P.air = keep.air; P.crease = keep.crease;
    P.vignette = keep.vig; P.contrast = keep.con; P.bloom = keep.bloom;
    return { biome: g.biome.current, radius: keepR, sunY: +dir.y.toFixed(3),
             rows: rows, err: g.state.lastError || null };
  });
  await page.evaluate(o => fetch('/shot?name=shadowpen.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
