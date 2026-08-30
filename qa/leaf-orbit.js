async page => {
  const PICK = [['sydney','Digit1'],['palawan','Equal'],['pantanal','Semicolon']];
  const out = [];
  for (const [name, key] of PICK) {
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload();
    await page.waitForTimeout(5200);
    await page.keyboard.press(key);
    await page.waitForTimeout(7000);
    const row = await page.evaluate(async () => {
      const g = window.__capy, T = g.THREE;
      const c = g.canvas || g.renderer.domElement;
      const s = g.state, cam = g.camera;
      // Drive the camera by hand and never tick again, so the ONLY thing that
      // differs between the two arms of each azimuth is the switch. One tick
      // per arm is still needed to push noLeaf into the shared uniform, so the
      // camera is re-imposed AFTER the tick and asserted in the row.
      const cp = g.capy.position;
      const R = 11, H = 6.2;
      const cv = document.createElement('canvas');
      cv.width = c.width; cv.height = c.height;
      const cx = cv.getContext('2d', { willReadFrequently: true });
      async function lum(url) {
        const im = new Image();
        await new Promise(r => { im.onload = r; im.src = url; });
        cx.drawImage(im, 0, 0);
        const d = cx.getImageData(0, 0, cv.width, cv.height).data;
        return d;
      }
      function cmp(a, b) {
        // PER-PIXEL, NOT PER-FRAME. A term that lights a few hundred canopy
        // facets moves the frame mean by a thousandth and is invisible to it --
        // the same mistake measuring a defocus with mean luminance was. Count
        // the pixels that actually moved and report how far they moved.
        let hit = 0, sum = 0, peak = 0, n = 0;
        for (let i = 0; i < a.length; i += 4) {
          const la = 0.2126*a[i]+0.7152*a[i+1]+0.0722*a[i+2];
          const lb = 0.2126*b[i]+0.7152*b[i+1]+0.0722*b[i+2];
          const dv = lb - la; n++;
          if (dv > 2) { hit++; sum += dv; if (dv > peak) peak = dv; }
        }
        return { pct: +(100*hit/n).toFixed(3), mean: hit ? +(sum/hit).toFixed(2) : 0,
                 peak: +peak.toFixed(1) };
      }
      const place = (a) => {
        cam.position.set(cp.x + Math.sin(a) * R, cp.y + H, cp.z + Math.cos(a) * R);
        cam.lookAt(cp.x, cp.y + 0.6, cp.z);
        cam.updateMatrixWorld(true);
        cam.updateProjectionMatrix();
      };
      const rows = [];
      // The sun, and which way the camera has to face to be looking INTO it.
      const sun = g.__sunDir || null;
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        const shots = [];
        for (const off of [true, false]) {
          s.noLeaf = off;
          g.tick(0, false);
          place(a);
          g.post.render();
          shots.push([off, c.toDataURL('image/png')]);
        }
        const dOff = await lum(shots[0][1]);
        const dOn = await lum(shots[1][1]);
        const cc = cmp(dOff, dOn);
        if (i === 2) {
          await fetch('/shot?name=ORBIT-off', { method: 'POST', body: shots[0][1] });
          await fetch('/shot?name=ORBIT-on', { method: 'POST', body: shots[1][1] });
        }
        rows.push({ deg: i * 45, pct: cc.pct, mean: cc.mean, peak: cc.peak });
      }
      s.noLeaf = false;
      return { biome: g.biome.current, sun: sun, rows: rows,
               err: g.state.lastError || null };
    });
    row.want = name;
    out.push(row);
  }
  await page.evaluate(o => fetch('/shot?name=leaforbit.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out);
}
