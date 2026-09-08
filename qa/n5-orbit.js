async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(4800);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  const list = await page.evaluate(async () => {
    const mod = await import('/src/shared.js');
    return mod.CHAPTERS.map(c => c.biome);
  });
  const rows = [];
  for (const b of list) {
    const r = await page.evaluate(async (bi) => {
      const g = window.__capy;
      const out = { biome: bi, steps: [] };
      const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
      try { g.biome.switchTo(bi); } catch (e) { out.err = String(e && e.message); return out; }
      const sp = g.biome.spawnOf(bi);
      if (sp) { g.capy.body.position.set(sp.x, sp.y + 0.5, sp.z); g.capy.body.velocity.set(0, 0, 0); }
      tick(240);
      // ---- WALK THE BOOM ROUND THE ANIMAL AND ASK IF IT CAN SEE IT --------
      // The item's own first instruction: a drifting camera for minutes will
      // find every clipping fault the boom sweeps missed, so measure the ORBIT
      // before building one. `frameShot` is the only way in from outside to
      // aim the rig, and `camInfo.clear` is the rig's own answer — 1 is a clear
      // line to the animal, and anything under it is the boom being cut short
      // by something solid between the lens and the capybara.
      let cut = 0, worst = 1, sum = 0, n = 0;
      for (let s = 0; s < 24; s++) {
        const yaw = (s / 24) * Math.PI * 2;
        g.frameShot({ yaw: yaw, dist: 6.0, pitch: 0.52, hold: 6, w: 1 });
        tick(60);
        const c = g.camInfo.clear;
        sum += c; n++;
        if (c < 0.999) cut++;
        if (c < worst) worst = c;
        if (s % 6 === 0) out.steps.push({ s: s, clear: +c.toFixed(3) });
      }
      g.frameShot(null);
      out.cut = cut; out.of = n;
      out.mean = +(sum / n).toFixed(3);
      out.worst = +worst.toFixed(3);
      out.spawn = sp ? { x: +sp.x.toFixed(1), z: +sp.z.toFixed(1) } : null;
      out.lastError = g.state.lastError || null;
      return out;
    }, b);
    rows.push(r);
  }
  await page.evaluate((o) => fetch('/shot?name=n5-orbit.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), rows);
}
