async page => {
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 200)));
  await page.addInitScript(() => {
    try { localStorage.clear() } catch (e) {}
    // the shutter hangs the full PNG off an <a download> and clicks it; a
    // download in this harness kills the browser, and it is not what is under
    // test — the ALBUM thumbnail is.
    try {
      const c0 = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () {
        if (this.hasAttribute('download')) { window.__dl = (window.__dl || 0) + 1; return }
        return c0.apply(this, arguments);
      };
    } catch (e) {}
  });
  await page.reload();
  await page.waitForFunction(() => window.__capy && window.__capy.biome, null, { timeout: 30000 });
  await page.keyboard.press('Digit1');
  await page.waitForFunction(() => window.__capy.state.started, null, { timeout: 20000 });
  await page.waitForTimeout(1500);
  const setup = await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('cave');
    const cav = g.cave, b = g.capy.body;
    const X = 0, Z = -86;
    b.position.set(X, cav.terrainHeight(X, Z) + 0.8, Z);
    b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    return { day: +cav.daylight().toFixed(3), terr: +cav.terrainHeight(X, Z).toFixed(2) };
  });
  await page.waitForTimeout(3000);
  const at = await page.evaluate(() => {
    const g = window.__capy, cav = g.cave, cp = g.capy.position, cam = g.camera.position;
    return { day: +cav.daylight().toFixed(3), capy: [+cp.x.toFixed(1), +cp.y.toFixed(1), +cp.z.toFixed(1)],
             cam: [+cam.x.toFixed(1), +cam.y.toFixed(1), +cam.z.toFixed(1)],
             bio: g.biome.current, echoReady: cav.echoReady() };
  });
  // ---- photo mode on ----
  await page.keyboard.press('KeyK');
  await page.waitForTimeout(1400);
  const lensA = await page.evaluate(() => window.__capy.hud.photoAudit());
  // photo A: NO light
  await page.keyboard.press('Enter');
  await page.waitForTimeout(900);
  // photo B: with the wheek
  const w = await page.evaluate(() => {
    const g = window.__capy;
    g.events.emit('capy:wheek', {});
    return { echo: +g.cave.echo().toFixed(3) };
  });
  await page.waitForTimeout(180);
  const echoAt = await page.evaluate(() => +window.__capy.cave.echo().toFixed(3));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);
  const alb = await page.evaluate(() => {
    const g = window.__capy;
    let shots = [];
    try { const o = JSON.parse(localStorage.getItem('capy3.album.v1') || '{}'); shots = o.shots || [] } catch (e) {}
    return { audit: g.hud.albumAudit ? g.hud.albumAudit() : null, n: shots.length,
             meta: shots.map(s => ({ place: s.place, cap: s.cap, n: s.n, len: (s.u || '').length })),
             a: shots[0] ? shots[0].u : '', b: shots[1] ? shots[1].u : '' };
  });
  const post = async (name, dataurl) => {
    if (!dataurl) return;
    await page.evaluate(async o => {
      await fetch('/shot?name=' + o.n, { method: 'POST', body: o.d.replace(/^data:image\/\w+;base64,/, '') });
    }, { n: name, d: dataurl });
  };
  await post('b4cav-photoA.jpg', alb.a);
  await post('b4cav-photoB.jpg', alb.b);
  const lums = await page.evaluate(async () => {
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
        let s = 0, mx = 0, dark = 0; const n = d.length / 4;
        for (let i = 0; i < d.length; i += 4) {
          const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
          s += l; if (l > mx) mx = l; if (l < 16) dark++;
        }
        res({ w: im.width, h: im.height, mean: +(s / n).toFixed(2), max: +mx.toFixed(0), pctUnder16: +(dark / n * 100).toFixed(1) });
      };
      im.onerror = () => res(null);
      im.src = u;
    });
    const r = [];
    for (const s of shots) r.push(await lum(s.u));
    return r;
  });
  const out = { errs, setup, at, lensA, w, echoAt, n: alb.n, audit: alb.audit, meta: alb.meta, lums };
  await page.evaluate(async o => {
    await fetch('/shot?name=b4cav-2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, out);
}
