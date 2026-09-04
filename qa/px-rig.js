async page => {
  const KEYS = { sydney: 'Digit1', pasto: 'Digit2', kyoto: 'Digit4', rio: 'Digit6',
                 drift: 'Digit9', goreme: 'BracketLeft' };
  const out = [];
  for (const name of ['pasto', 'rio']) {
    await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(4300);
    await page.keyboard.press(KEYS[name]);
    await page.waitForTimeout(5500);
    const r = await page.evaluate(() => {
      const g = window.__capy, inp = g.input, D = 1 / 60, b = g.capy.body;
      let sact = false, sactEdge = false;
      function T(k) {
        for (let i = 0; i < k; i++) {
          inp.x = 0; inp.z = 0; inp.run = false;
          inp.action = sact; inp.actionPressed = sactEdge; sactEdge = false;
          inp.honk = false; inp.whistle = false;
          g.tick(D, false);
        }
      }
      const flyEl = document.querySelector('.capyui-fly');
      const rd = () => ({
        reach: +g.camInfo.reach.toFixed(1),
        pitch: +(g.camInfo.pitch * 180 / Math.PI).toFixed(1),
        alt: flyEl ? (flyEl.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40) : null,
        hud: !!(flyEl && flyEl.classList.contains('show')),
        therm: !!document.querySelector('.capyui-therm.on, .capyui-fly .on'),
      });
      const o = { biome: g.biome.current,
                  hosted: !!(g[g.biome.current] && g[g.biome.current].thermals),
                  api: !!(g.condor && g.condor.hosted && g.condor.hosted()),
                  ground: rd() };
      if (!o.hosted) { o.err = g.state.lastError || null; return o; }
      // Mount, deterministically: whistle until the talons are in reach, then E.
      let t = -1;
      for (let s = 0; s < 80; s++) {
        T(45);
        if (s % 8 === 6) g.condor.summon();
        if (g.condor.talonInReach()) { t = s; break; }
      }
      o.tReach = t;
      if (t < 0) { o.err = g.state.lastError || null; return o; }
      // The talons swing past; one press is a coin toss. Press on every frame
      // the reach test is true until it takes, for up to a second and a half.
      for (let a = 0; a < 90 && !g.condor.mounted; a++) {
        sact = g.condor.talonInReach(); sactEdge = sact; T(1);
      }
      sact = false; sactEdge = false;
      T(330);
      o.mounted = !!g.condor.mounted;
      o.flying = rd();
      // ...and now the altitude, which is the other half of the same gate. Lift
      // the BIRD, let the constraint carry the passenger, and read the altimeter.
      if (o.mounted && g.condor.body) {
        const cb = g.condor.body;
        cb.position.y += 90; cb.aabbNeedsUpdate = true;
        b.position.y += 90; b.aabbNeedsUpdate = true;
        T(20);
        o.high = rd();
        o.highY = +b.position.y.toFixed(1);
        o.stillMounted = !!g.condor.mounted;
        // ...and the THERMAL lamp, which is the third thing that asked for
        // Pasto by name. Put the bird inside the host's own strongest column.
        const api = g[g.biome.current];
        let th = api && api.thermals;
        if (typeof th === 'function') th = th();
        if (th && th.length) {
          const c0 = th[0];
          const y = Math.min((c0.top || 120) - 20, 90);
          cb.position.set(c0.x, y, c0.z); cb.velocity.set(0, 0, 0); cb.aabbNeedsUpdate = true;
          b.position.set(c0.x, y - 2, c0.z); b.aabbNeedsUpdate = true;
          T(30);
          o.inColumn = rd();
          o.colAt = [c0.x, +y.toFixed(0), c0.z];
          o.capAt = [+b.position.x.toFixed(1), +b.position.y.toFixed(1), +b.position.z.toFixed(1)];
        }
      }
      o.err = g.state.lastError || null;
      return o;
    });
    out.push(r);
  }
  await page.evaluate(o => fetch('/shot?name=px-rig.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
