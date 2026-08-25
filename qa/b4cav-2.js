async page => {
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 200)));
  page.on('download', d => { try { d.cancel() } catch (e) {} });
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} });
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
  const out = { errs, setup, at, lensA, w, echoAt, n: alb.n, audit: alb.audit, meta: alb.meta };
  await page.evaluate(async o => {
    await fetch('/shot?name=b4cav-2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, out);
}
