async page => {
  const CH = [['Quote', 'cave', ['KeyS', 'KeyA']], ['Minus', 'kowloon', ['KeyA']],
              ['Digit1', 'sydney', ['KeyW']]];
  const out = [];
  for (const [key, name, legs] of CH) {
    await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(4300);
    await page.keyboard.press(key);
    await page.waitForTimeout(5800);
    await page.evaluate(() => {
      const g = window.__capy;
      window.__b2 = { n: 0, cut: 0, worst: 1, minD: 99, jump: 0, lastD: null };
      window.__b2T = setInterval(() => {
        const s = window.__b2, cam = g.camera.position, p = g.capy.position;
        const d = Math.hypot(cam.x - p.x, cam.y - p.y, cam.z - p.z);
        s.n++;
        if (g.camInfo.clear < 0.999) s.cut++;
        if (g.camInfo.clear < s.worst) s.worst = g.camInfo.clear;
        if (d < s.minD) s.minD = d;
        // A POP is the thing a snapped radius would produce: a frame-to-frame
        // jump in the boom bigger than a fast walk could account for.
        if (s.lastD !== null) { const j = Math.abs(d - s.lastD); if (j > s.jump) s.jump = j; }
        s.lastD = d;
      }, 33);
    });
    for (const k of legs) await page.keyboard.down(k);
    await page.waitForTimeout(3000);
    const r = await page.evaluate(() => {
      const s = window.__b2, g = window.__capy;
      return { biome: g.biome.current, n: s.n, cut: s.cut, worst: +s.worst.toFixed(2),
               minD: +s.minD.toFixed(2), maxJump: +s.jump.toFixed(2),
               err: g.state.lastError || null };
    });
    r.leg = legs.join('+');
    await page.screenshot({ path: 'qa/px-boom2-' + name + '.png' });
    for (const k of legs) await page.keyboard.up(k);
    await page.evaluate(() => clearInterval(window.__b2T));
    out.push(r);
  }
  await page.evaluate(o => fetch('/shot?name=px-boom2.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
