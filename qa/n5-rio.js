async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(4800);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const o = { rows: [] };
    const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
    // RIO IS THE WORST CHAPTER FOR THIS by the orbit sweep — nineteen bearings
    // of twenty-four cut, mean clear 0.646 — so it is the one that says whether
    // a drifting lens is safe. Venice and the Quay next.
    for (const bi of ['rio', 'venice', 'quay', 'sydney']) {
      g.biome.switchTo(bi);
      const sp = g.biome.spawnOf(bi);
      if (sp) { g.capy.body.position.set(sp.x, sp.y + 0.5, sp.z); g.capy.body.velocity.set(0, 0, 0); }
      tick(300);
      // wait for it to be properly asleep, then orbit for three minutes
      for (let i = 0; i < 60 * 60 && g.capy.nap < 0.9; i++) g.tick(1 / 60, false);
      const napped = g.capy.nap >= 0.9;
      let worst = 1, cut = 0, n = 0, insideN = 0;
      const eye = { x: 0, z: 0 };
      let travel = 0;
      eye.x = g.camera.position.x; eye.z = g.camera.position.z;
      for (let i = 0; i < 60 * 180; i++) {
        g.tick(1 / 60, false);
        if (i % 10 === 0) {
          const c = g.camInfo.clear;
          n++;
          if (c < 0.999) cut++;
          if (c < worst) worst = c;
          // ...AND THE ONE THING A CUT CANNOT CATCH: the eye ending up nearer
          // the animal than the near plane, which is what a boom cut to nothing
          // looks like from inside.
          const d = Math.hypot(g.camera.position.x - g.capy.position.x,
                               g.camera.position.z - g.capy.position.z);
          if (d < 1.0) insideN++;
          travel += Math.hypot(g.camera.position.x - eye.x, g.camera.position.z - eye.z);
          eye.x = g.camera.position.x; eye.z = g.camera.position.z;
        }
      }
      o.rows.push({ biome: bi, napped: napped, cutPct: Math.round(100 * cut / Math.max(1, n)),
                    worst: +worst.toFixed(3), inside: insideN,
                    travelM: +travel.toFixed(1),
                    shots: g.napDebug().shots, album: g.napDebug().album });
    }
    o.lastError = g.state.lastError || null;
    return o;
  });
  await page.evaluate((o) => fetch('/shot?name=n5-rio.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
  // ...and what the album actually looks like, which is the only test of a
  // 288x180 thumbnail that means anything.
  await page.evaluate(() => { try { window.__capy.hud.albumShow(); } catch (e) {} });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: 'qa/N5-album.png' });
}
