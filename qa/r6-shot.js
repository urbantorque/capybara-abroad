async page => {
  // R6 is deliberately invisible — there is nothing new on the screen and that
  // is the whole design. This is the regression picture: the floor still lights
  // on the beat, the dancers are still on their ring, and the combo still paints.
  await page.reload();
  await page.evaluate(() => new Promise(r => setTimeout(r, 4500)));
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.evaluate(() => new Promise(r => setTimeout(r, 5500)));
  await page.keyboard.press('Digit1');
  await page.evaluate(() => new Promise(r => setTimeout(r, 4000)));

  await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('cali');
    const sp = g.biome.spawnOf('cali'), b = g.capy.body;
    if (sp) { b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0); }
  });
  await page.evaluate(() => new Promise(r => setTimeout(r, 3500)));

  // On the floor, dancing — a few steps in, so the board is lit and the
  // escalating cheer has started.
  await page.evaluate(() => {
    const g = window.__capy, A = g.cali, f = A.floor;
    const b = g.capy.body;
    const y = A.terrainHeight(f.x, f.z) + 0.6;
    const raw = g.tick.bind(g);
    window.__rawTick = raw;
    g.tick = function (dt, r) {
      b.position.set(f.x, y, f.z); b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      const m = g.music;
      if (m && m.playing && Math.abs(m.off()) < 0.05) g.input.jumpPressed = true;
      return raw(dt, r);
    };
  });
  await page.evaluate(() => new Promise(r => setTimeout(r, 6000)));

  const info = await page.evaluate(() => {
    const g = window.__capy, A = g.cali;
    return { combo: A.combo(), mercy: A.mercy(), window: +A.window().toFixed(3),
             onFloor: A.onFloor(), biome: g.biome.current,
             err: g.state.lastError ? String(g.state.lastError) : null };
  });

  const shot = await page.evaluate(() => {
    const g = window.__capy;
    g.renderer.setSize(1280, 760, false);
    g.tick(1 / 60, true);
    return g.renderer.domElement.toDataURL('image/png').split(',')[1];
  });
  await page.evaluate(s => fetch('/shot?name=r6-floor', { method: 'POST', body: s }), shot);
  await page.evaluate(o => {
    window.__capy.tick = window.__rawTick;
    return fetch('/shot?name=r6-shot.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, info);
}
