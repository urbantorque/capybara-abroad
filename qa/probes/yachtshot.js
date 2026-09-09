async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2000);
  const SPOTS = [
    { n: 'Y1-stern', x: 10, y: 4.0, z: -84, yaw: 0.0 },
    { n: 'Y2-flightA', x: 7.8, y: 3.6, z: -76.5, yaw: 0.0 },
    { n: 'Y3-bridge', x: 6.9, y: 6.3, z: -66, yaw: 0.0 },
    { n: 'Y4-flightB', x: 10, y: 6.3, z: -52.0, yaw: 3.14 },
    { n: 'Y5-sundeck', x: 10.4, y: 9.1, z: -60.0, yaw: 3.14 },
    { n: 'Y6-beam', x: -10, y: 3.0, z: -60, yaw: 1.57 },
  ];
  const out = await page.evaluate(async (S) => {
    const g = window.__capy;
    const down = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }));
    const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }));
    const wrap = a => { while (a > Math.PI) a -= 6.283185; while (a < -Math.PI) a += 6.283185; return a; };
    g.biome.switchTo('monaco');
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false);
    g.renderer.setSize(1280, 760, false);
    g.camera.aspect = 1280 / 760; g.camera.updateProjectionMatrix();
    const res = [];
    for (const s of S) {
      const b = g.capy.body;
      const hold = () => {
        b.position.set(s.x, s.y, s.z); b.velocity.set(0, 0, 0);
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      };
      hold();
      for (let i = 0; i < 60; i++) { g.tick(1 / 60, false); hold(); }
      for (let i = 0; i < 900; i++) {
        const d = wrap(s.yaw - g.input.camYaw);
        if (Math.abs(d) < 0.02) break;
        const k = d > 0 ? 'KeyZ' : 'KeyX';
        down(k); g.tick(1 / 60, false); up(k); hold();
      }
      for (let i = 0; i < 100; i++) { g.tick(1 / 60, false); hold(); }
      g.tick(1 / 60, true);
      const url = g.renderer.domElement.toDataURL('image/png');
      await fetch('/shot?name=' + s.n + '.png', { method: 'POST', body: url.split(',')[1] });
      res.push({ n: s.n, err: g.state.lastError || null });
    }
    return res;
  }, SPOTS);
  await page.evaluate(async (o) => {
    await fetch('/shot?name=yacht.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, out);
}
