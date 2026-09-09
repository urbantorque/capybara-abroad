async page => {
  await page.reload();
  await page.evaluate(() => {
    window.__err = [];
    const e0 = console.error;
    console.error = function () { window.__err.push([].slice.call(arguments).join(' ')); e0.apply(console, arguments); };
    window.addEventListener('error', ev => window.__err.push('WINDOW ' + (ev.message || ev.error)));
  });
  await page.waitForFunction(() => window.__capy && window.__capy.biome, null, { timeout: 30000 });
  await page.keyboard.press('Minus');
  await page.waitForFunction(() => window.__capy.biome.current === 'kowloon', null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const k = window.__capy.kowloon;
    k.rig = function () { return { w: 1, dist: 16, pitch: 0.28, raise: 1.4, lambda: 3 }; };
  });

  // wait for the lion to be resting on the road, then walk the animal up it
  const out = { trace: [], errors: [] };
  for (let i = 0; i < 80; i++) {
    const s = await page.evaluate(() => {
      const g = window.__capy;
      const p = g.kowloon.lion();
      return { y: +p.y.toFixed(2), z: +p.z.toFixed(1) };
    });
    if (s.y < 0.2) break;
    await page.waitForTimeout(500);
  }
  // stand the animal on the lion's back
  await page.evaluate(() => {
    const g = window.__capy;
    const p = g.kowloon.lion();
    g.capy.body.position.set(p.x, p.y + 1.4, p.z);
    g.capy.body.velocity.set(0, 0, 0);
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'qa/lion-rest.png' });

  let shotPoles = false, shotRear = false;
  for (let i = 0; i < 80; i++) {
    await page.waitForTimeout(500);
    const s = await page.evaluate(() => {
      const g = window.__capy;
      const p = g.kowloon.lion();
      const c = g.capy.position;
      return { ly: +p.y.toFixed(2), lz: +p.z.toFixed(1),
               cx: +c.x.toFixed(2), cy: +c.y.toFixed(2), cz: +c.z.toFixed(1),
               dy: +(c.y - p.y).toFixed(2),
               gap: +Math.hypot(c.x - p.x, c.z - p.z).toFixed(2),
               score: g.state.score };
    });
    out.trace.push(s);
    if (!shotPoles && s.ly > 2.0) { shotPoles = true; await page.screenshot({ path: 'qa/lion-poles.png' }); }
    if (!shotRear && s.ly > 4.2) { shotRear = true; await page.screenshot({ path: 'qa/lion-rear.png' }); }
    if (shotRear && s.ly < 3.0) break;
  }
  out.errors = await page.evaluate(() => window.__err.slice(0, 10));
  out.done = await page.evaluate(() => [].slice.call(document.querySelectorAll('.done'))
    .map(e => (e.textContent || '').trim()));
  await page.evaluate(async o => {
    await fetch('/shot?name=lion-result.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
