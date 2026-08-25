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
    window.__q = { fired: 0, grade: [] };
    const ct = g.completeTask.bind(g);
    g.completeTask = function (id, s) { const r = ct(id, s); if (r && id === 'samba-parade') window.__q.fired = 1; return r; };
    const r = g.rio; const orig = r.update.bind(r);
    r.update = function (dt) {
      const cx = r.columnX(), cz = 46, y = r.terrainHeight(cx, cz) + 0.45;
      const bb = g.capy.body;
      bb.position.set(cx, y, cz); bb.velocity.set(0,0,0);
      bb.previousPosition.copy(bb.position); bb.interpolatedPosition.copy(bb.position);
      g.capy.position.set(cx, y, cz);
      const mus = g.music; let honk = false;
      if (mus && mus.playing && !window.__q.fired) {
        const bt = mus.beats(), idx = Math.round(bt);
        if (((idx % 2) + 2) % 2 === 1 && Math.abs(bt - idx) < 0.08) { g.input.honkPressed = true; honk = true; }
      }
      orig(dt);
      if (honk) g.input.honkPressed = false;
      // sample the post-processing grade every frame after the fire
      if (window.__q.fired && window.__q.grade.length < 400) {
        const bl = g.bloomPass || (g.composer && g.composer.passes && g.composer.passes.find(p => p.strength !== undefined));
        if (bl) window.__q.grade.push([+g.state.time.toFixed(2), +bl.strength.toFixed(4), +(bl.threshold||0).toFixed(4)]);
      }
    };
  });
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(3000);
    const f = await page.evaluate(() => window.__q.fired);
    if (f) break;
  }
  await page.waitForTimeout(1100);
  await page.screenshot({ path: 'qa/B6-marquee.png' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'qa/B6-marquee-late.png' });
  const out = await page.evaluate(() => {
    const g = window.__capy, q = window.__q, cam = g.camera, p = g.capy.position;
    return { fired: q.fired, gradeSamples: q.grade.length,
      gradeFirst: q.grade[0] || null, gradeMid: q.grade[Math.floor(q.grade.length/2)] || null,
      gradeLast: q.grade[q.grade.length-1] || null,
      bloomRange: q.grade.length ? [Math.min(...q.grade.map(a=>a[1])), Math.max(...q.grade.map(a=>a[1]))] : null,
      dist: +Math.hypot(cam.position.x-p.x, cam.position.z-p.z).toFixed(2),
      pitchDeg: +(Math.atan2(cam.position.y-p.y, Math.hypot(cam.position.x-p.x, cam.position.z-p.z))*180/Math.PI).toFixed(1),
      err: g.state.lastError || null };
  });
  await page.evaluate((o) => fetch('/shot?name=rio4.json', { method:'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out);
}
