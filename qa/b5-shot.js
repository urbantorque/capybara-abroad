async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5500);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2500);

  const SHOTS = [
    ['goreme', 'ridge', 78, 30, 2.2],
    ['goreme', 'cliff', -68, -40, -1.4],
    ['goreme', 'valley', -20, 8, 1.0],
    ['monaco', 'arcade', -146, -30, 0.0],
    ['monaco', 'ramp', -128, -6, 2.0],
    ['sahara', 'square', 0, 12, 1.2],
  ];
  for (const [nm, tag, x, z, yaw] of SHOTS) {
    await page.evaluate(async (q) => {
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
      const g = window.__capy;
      if (g.biome.current !== q.nm) { g.biome.switchTo(q.nm); await sleep(1200); }
      for (let i = 0; i < 25; i++) g.tick(1 / 60, false);
      const api = g[q.nm];
      const th = (a, b) => { const v = api.terrainHeight(a, b); return (typeof v === 'number' && v === v) ? v : 0; };
      const b = g.capy.body;
      g.capy.face(q.yaw); g.capy.carriedBy = null;
      b.position.set(q.x, th(q.x, q.z) + 0.6, q.z);
      b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      g.renderer.setSize(1280, 700, false);
      for (let i = 0; i < 70; i++) g.tick(1 / 60, false);
      await sleep(350);
      g.tick(1 / 60, true);
      const p = g.capy.renderPosition;
      g.camera.position.set(p.x - Math.sin(q.yaw) * 9, p.y + 5.0, p.z - Math.cos(q.yaw) * 9);
      g.camera.lookAt(p.x + Math.sin(q.yaw) * 5, p.y + 1.5, p.z + Math.cos(q.yaw) * 5);
      g.camera.updateMatrixWorld(true);
      g.renderer.setRenderTarget(null);
      g.renderer.render(g.scene, g.camera);
      const url = g.renderer.domElement.toDataURL('image/png');
      await fetch('/shot?name=b5-' + q.nm + '-' + q.tag + '.png', { method: 'POST', body: url.split(',')[1] });
    }, { nm: nm, tag: tag, x: x, z: z, yaw: yaw });
    await page.waitForTimeout(350);
  }

  // ---- soak, and a walk into each new collider to prove it stops you
  const soak = await page.evaluate(async () => {
    const g = window.__capy;
    const out = {};
    for (const nm of ['goreme', 'monaco']) {
      if (g.biome.current !== nm) g.biome.switchTo(nm);
      for (let i = 0; i < 30; i++) g.tick(1 / 60, false);
      const sp = g.biome.spawnOf(nm), b = g.capy.body;
      b.position.set(sp.x, (sp.y || 1) + 0.4, sp.z);
      b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      for (let t = 0; t < 3600; t++) {
        if (t > 600 && t < 3000) { g.input.x = Math.sin(t / 110) * 0.9; g.input.z = Math.cos(t / 170) * 0.9; }
        else { g.input.x = 0; g.input.z = 0; }
        g.tick(1 / 60, false);
      }
      g.input.x = 0; g.input.z = 0;
      out[nm] = {
        biome: g.biome.current,
        lastError: g.state.lastError ? String(g.state.lastError).slice(0, 160) : null,
        bodies: g.world.bodies.length,
        y: +b.position.y.toFixed(2),
      };
    }
    return out;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b5-soak.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, soak);
}
