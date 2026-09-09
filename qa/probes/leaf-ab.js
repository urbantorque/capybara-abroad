async page => {
  const PICK = [['sydney','Digit1'],['kyoto','Digit4'],['palawan','Equal'],
                ['pantanal','Semicolon'],['cali','Digit5']];
  const out = [];
  for (const [name, key] of PICK) {
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload();
    await page.waitForTimeout(5200);
    await page.keyboard.press(key);
    await page.waitForTimeout(7000);
    const row = await page.evaluate(async () => {
      const g = window.__capy;
      const c = g.canvas || g.renderer.domElement;
      const s = g.state;
      // post.render() only, and every arm captured before any is decoded --
      // the two rules the depth pass paid for. But noLeaf reaches the shader
      // through a shared uniform written by sysDressFrame, so ONE tick is
      // needed per arm to push it; tick(0) is enough and the camera is
      // asserted in the row.
      const shots = [];
      for (const off of [true, false]) {
        s.noLeaf = off;
        g.tick(0, false);
        g.post.render();
        shots.push([off ? 'off' : 'on', c.toDataURL('image/png'),
                    g.camera.position.x, g.camera.position.y, g.camera.position.z]);
      }
      s.noLeaf = false;
      const cv = document.createElement('canvas');
      cv.width = c.width; cv.height = c.height;
      const cx = cv.getContext('2d', { willReadFrequently: true });
      const res = {};
      for (const [tag, url, px_, py_, pz_] of shots) {
        await fetch('/shot?name=LEAF-' + tag, { method: 'POST', body: url });
        const im = new Image();
        await new Promise(r => { im.onload = r; im.src = url; });
        cx.drawImage(im, 0, 0);
        const d = cx.getImageData(0, 0, cv.width, cv.height).data;
        let lum = 0, n = 0, hi = 0;
        for (let i = 0; i < d.length; i += 4 * 5) {
          const L = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
          lum += L; n++;
          if (L > 235) hi++;
        }
        res[tag] = { lum: lum / n, blown: (hi / n) * 100,
                     cam: [+px_.toFixed(4), +py_.toFixed(4), +pz_.toFixed(4)] };
      }
      return { biome: g.biome && g.biome.current,
               dLum: +(res.on.lum - res.off.lum).toFixed(3),
               blownOff: +res.off.blown.toFixed(3), blownOn: +res.on.blown.toFixed(3),
               camSame: res.on.cam.join() === res.off.cam.join(),
               err: g.state.lastError || null };
    });
    row.want = name;
    out.push(row);
    await page.screenshot({ path: 'qa/LEAF-' + name + '.png' });
  }
  await page.evaluate(o => fetch('/shot?name=leafab.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
