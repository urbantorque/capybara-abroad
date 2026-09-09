async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(3000);

  const out = { started: await page.evaluate(() => !!window.__capy.state.started), soak: {}, flat: {} };

  // ---- 60 s soak in the two chapters the pose bites hardest in
  for (const nm of ['pasto', 'monaco']) {
    out.soak[nm] = await page.evaluate(async (nm) => {
      const g = window.__capy;
      if (g.biome.current !== nm) g.biome.switchTo(nm);
      for (let i = 0; i < 30; i++) g.tick(1 / 60, false);
      if (g.biome.current !== nm) return { bad: 'wrong biome' };
      const sp = g.biome.spawnOf(nm), b = g.capy.body;
      b.position.set(sp.x, (sp.y || 1) + 0.4, sp.z);
      b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position);
      b.interpolatedPosition.copy(b.position);
      // half of it walking, so the pose is exercised and not merely resting
      for (let t = 0; t < 1800; t++) {
        if (t > 600 && t < 2400) { g.input.x = Math.sin(t / 90) * 0.9; g.input.z = 0.8; }
        g.tick(1 / 60, false);
      }
      g.input.x = 0; g.input.z = 0;
      for (let t = 0; t < 1800; t++) g.tick(1 / 60, false);
      return {
        lastError: g.state.lastError ? String(g.state.lastError).slice(0, 160) : null,
        restY: +b.position.y.toFixed(2),
        bodies: g.world.bodies.length,
        biome: g.biome.current,
      };
    }, nm);
  }

  // ---- the flat chapters must be untouched: the pose channels stay at zero
  for (const nm of ['sydney', 'kowloon', 'quay', 'hanoi']) {
    out.flat[nm] = await page.evaluate(async (nm) => {
      const g = window.__capy;
      if (g.biome.current !== nm) g.biome.switchTo(nm);
      for (let i = 0; i < 30; i++) g.tick(1 / 60, false);
      if (g.biome.current !== nm) return { bad: 'wrong biome' };
      let model = null;
      for (const c of g.capy.group.children) if (c.isGroup && c.position.y < -0.1 && c.position.y > -0.9) { model = c; break; }
      const sp = g.biome.spawnOf(nm), b = g.capy.body;
      b.position.set(sp.x, (sp.y || 1) + 0.4, sp.z);
      b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position);
      b.interpolatedPosition.copy(b.position);
      let mx = 0, mz = 0, my = 0;
      for (let t = 0; t < 420; t++) {
        if (t > 120) { g.input.x = 0.5; g.input.z = 0.85; }
        g.tick(1 / 60, false);
        if (t > 150) {
          mx = Math.max(mx, Math.abs(model.rotation.x));
          mz = Math.max(mz, Math.abs(model.rotation.z));
          my = Math.max(my, Math.abs(model.position.y + 0.34));
        }
      }
      g.input.x = 0; g.input.z = 0;
      return {
        biome: g.biome.current,
        maxRotX: +mx.toFixed(3), maxRotZ: +mz.toFixed(3), maxDy: +my.toFixed(3),
      };
    }, nm);
  }

  await page.evaluate(async (o) => {
    await fetch('/shot?name=b4-final.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);
}
