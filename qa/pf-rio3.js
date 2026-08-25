async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch(e){} });
  await page.reload();
  await page.waitForTimeout(6000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('rio');
    const b = g.capy.body; b.position.set(0,1.4,0); b.velocity.set(0,0,0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    window.__q = { log: [], sfx: [], score0: g.state.score, fired: 0, at: null };
    const osfx = g.sfx.bind(g);
    g.sfx = function (n, o) { window.__q.sfx.push({ n, at: !!(o && o.at), v: o && o.volume, t: +g.state.time.toFixed(2) }); return osfx(n, o); };
    const ct = g.completeTask.bind(g);
    g.completeTask = function (id, s) { const r = ct(id, s); if (r) { window.__q.log.push({ id, t: +g.state.time.toFixed(2) }); if (id === 'samba-parade') { window.__q.fired = 1; window.__q.at = g.state.time; } } return r; };
    const r = g.rio; const orig = r.update.bind(r);
    r.update = function (dt) {
      const cx = r.columnX(), cz = 46;
      const y = r.terrainHeight(cx, cz) + 0.45;
      const bb = g.capy.body;
      bb.position.set(cx, y, cz); bb.velocity.set(0, 0, 0);
      bb.previousPosition.copy(bb.position); bb.interpolatedPosition.copy(bb.position);
      g.capy.position.set(cx, y, cz);
      const mus = g.music;
      let honk = false;
      if (mus && mus.playing && !window.__q.fired) {
        const bt = mus.beats(); const idx = Math.round(bt);
        if (((idx % 2) + 2) % 2 === 1 && Math.abs(bt - idx) < 0.08) { g.input.honkPressed = true; honk = true; }
      }
      orig(dt);
      if (honk) g.input.honkPressed = false;
      if (!window.__q.fired) window.__q.combo = r.combo();
    };
  });
  // let real time run so the music scheduler is actually playing
  await page.waitForTimeout(20000);
  const mid = await page.evaluate(() => {
    const g = window.__capy, q = window.__q;
    return { fired: q.fired, combo: q.combo, musPlaying: !!(g.music && g.music.playing),
             beats: g.music ? g.music.beats() : null, log: q.log.slice(-8) };
  });
  if (!mid.fired) await page.waitForTimeout(20000);
  const out = await page.evaluate(() => {
    const g = window.__capy, q = window.__q;
    const cam = g.camera;
    const p = g.capy.position;
    const o = { mid: null, fired: q.fired, combo: g.rio.combo(), log: q.log,
      loudest: q.sfx.slice().sort((a, b) => (b.v || 0) - (a.v || 0)).slice(0, 8),
      cheers: q.sfx.filter(s => s.n === 'cheer').slice(-8),
      cam: { x: +cam.position.x.toFixed(2), y: +cam.position.y.toFixed(2), z: +cam.position.z.toFixed(2) },
      capy: { x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2) },
      dist: +Math.hypot(cam.position.x - p.x, cam.position.z - p.z).toFixed(2),
      yawDeg: +(Math.atan2(cam.position.x - p.x, cam.position.z - p.z) * 180 / Math.PI).toFixed(1),
      pitchDeg: +(Math.atan2(cam.position.y - p.y, Math.hypot(cam.position.x - p.x, cam.position.z - p.z)) * 180 / Math.PI).toFixed(1),
      score: g.state.score, err: g.state.lastError || null };
    return o;
  });
  await page.evaluate((o) => fetch('/shot?name=rio3.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out);
}
