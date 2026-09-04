async page => {
  const out = [];
  for (const [key, name] of [['Digit2', 'pasto'], ['Digit6', 'rio']]) {
    await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(4500);
    await page.keyboard.press(key);
    await page.waitForTimeout(5500);
    const res = await page.evaluate(() => {
      const g = window.__capy, inp = g.input, D = 1 / 60, b = g.capy.body;
      let sx = 0, sz = 0, sact = false, sactEdge = false;
      function T(k) {
        for (let i = 0; i < k; i++) {
          inp.x = sx; inp.z = sz; inp.run = false;
          inp.action = sact; inp.actionPressed = sactEdge; sactEdge = false;
          inp.honk = false; inp.whistle = false;
          g.tick(D, false);
        }
      }
      const cam = () => {
        const c = g.camera.position, p = b.position;
        const dx = c.x - p.x, dy = c.y - p.y, dz = c.z - p.z, hz = Math.hypot(dx, dz);
        return { dist: +Math.hypot(dx, dy, dz).toFixed(1), up: +dy.toFixed(1),
                 look: +(Math.atan2(dy, hz) * 180 / Math.PI).toFixed(1),
                 reach: +g.camInfo.reach.toFixed(1), pitch: +(g.camInfo.pitch * 180 / Math.PI).toFixed(1),
                 clear: +g.camInfo.clear.toFixed(2), lift: +g.camInfo.lift.toFixed(1) };
      };
      const r = { biome: g.biome.current, host: !!(g[g.biome.current] && g[g.biome.current].thermals) };
      r.ground = cam();
      r.summon = g.condor.summon();
      let tReach = -1;
      for (let s = 0; s < 70; s++) {
        T(60);
        if (s === 6 || s === 14 || s === 24) g.condor.summon();
        if (g.condor.talonInReach()) { tReach = s + 1; break; }
      }
      r.tReach = tReach; r.state = g.condor.state;
      if (tReach > 0) {
        sact = true; sactEdge = true; T(4); sact = false; T(30);
        r.mounted = !!g.condor.mounted;
        const fl = [];
        for (let s = 0; s < 24; s++) {
          const th = s * 0.25;
          sx = Math.sin(th) * 0.7; sz = -Math.cos(th) * 0.7;
          T(45);
          const c = cam();
          c.t = +(s * 0.75).toFixed(1); c.y = +b.position.y.toFixed(1);
          c.v = +Math.hypot(b.velocity.x, b.velocity.z).toFixed(1); c.m = !!g.condor.mounted;
          fl.push(c);
          if (!g.condor.mounted) break;
        }
        r.flight = fl;
        r.stillMounted = !!g.condor.mounted;
      }
      r.err = g.state.lastError || null;
      return r;
    });
    out.push(res);
    // a real frame of whatever the rig is doing right now
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'qa/px-cam-fly-' + name + '.png' });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: 'qa/px-cam-fly-' + name + '-2.png' });
  }
  await page.evaluate(o => fetch('/shot?name=px-fly.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
