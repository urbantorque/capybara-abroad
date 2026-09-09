async page => {
  const KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7',
                'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal', 'BracketLeft',
                'BracketRight', 'Semicolon', 'Quote', 'Comma', 'Period', 'Slash'];
  const FIRST = 0, LAST = 18;
  const rows = [];
  for (let k = FIRST; k <= LAST; k++) {
    await page.goto('http://localhost:5188/');
    await page.waitForTimeout(4200);
    await page.keyboard.press(KEYS[k]);
    await page.waitForTimeout(5200);
    // install a sampler that runs on the real clock, then walk about
    await page.evaluate(() => {
      const g = window.__capy;
      window.__cs = { n: 0, cut: 0, worst: 1, sum: 0, lift: 0, floor: 0, near: 0, biome: g.biome.current };
      window.__csT = setInterval(() => {
        const s = window.__cs, i = g.camInfo, c = g.capy;
        s.n++;
        s.sum += i.clear;
        if (i.clear < 0.999) s.cut++;
        if (i.clear < s.worst) s.worst = i.clear;
        if (i.lift > 0.01 || i.lift2 > 0.01) s.lift++;
        if (i.floor > 0.01) s.floor++;
        if (c && c.position) {
          const dx = g.camera.position.x - c.position.x;
          const dy = g.camera.position.y - c.position.y;
          const dz = g.camera.position.z - c.position.z;
          if (Math.sqrt(dx * dx + dy * dy + dz * dz) < 4) s.near++;
        }
      }, 50);
    });
    // four legs of a square, so the rig meets whatever is around the spawn
    const legs = ['KeyW', 'KeyD', 'KeyS', 'KeyA'];
    for (let i = 0; i < legs.length; i++) {
      await page.keyboard.down(legs[i]);
      await page.waitForTimeout(2200);
      await page.keyboard.up(legs[i]);
      await page.waitForTimeout(400);
    }
    const r = await page.evaluate(() => {
      clearInterval(window.__csT);
      const s = window.__cs, g = window.__capy;
      return { biome: s.biome, n: s.n,
               cutPct: +(100 * s.cut / Math.max(1, s.n)).toFixed(1),
               meanClear: +(s.sum / Math.max(1, s.n)).toFixed(3),
               worst: +s.worst.toFixed(3),
               liftPct: +(100 * s.lift / Math.max(1, s.n)).toFixed(1),
               floorPct: +(100 * s.floor / Math.max(1, s.n)).toFixed(1),
               nearPct: +(100 * s.near / Math.max(1, s.n)).toFixed(1),
               err: (g.state && g.state.lastError) ? String(g.state.lastError).slice(0, 120) : '' };
    });
    rows.push(r);
  }
  await page.evaluate(o => fetch('/shot?name=camsweep.json', {
    method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), rows);
}
