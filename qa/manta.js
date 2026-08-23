async page => {
  const out = { steps: [], errors: [] };
  await page.evaluate(() => {
    window.__err = [];
    const e0 = console.error;
    console.error = function () { window.__err.push([].slice.call(arguments).join(' ')); e0.apply(console, arguments); };
    window.addEventListener('error', ev => window.__err.push('WINDOW ' + (ev.message || ev.error)));
  });
  await page.waitForFunction(() => window.__capy && window.__capy.biome, null, { timeout: 30000 });
  await page.keyboard.press('Equal');
  await page.waitForFunction(() => window.__capy.biome.current === 'palawan', null, { timeout: 30000 });
  await page.waitForTimeout(2500);

  const info = await page.evaluate(() => {
    const g = window.__capy;
    const m = g.palawan.manta();
    return { biome: g.biome.current, capy: [g.capy.position.x, g.capy.position.y, g.capy.position.z],
             manta: [m.x, m.y, m.z] };
  });
  out.steps.push({ arrived: info });

  // Put the animal in the water next to the manta and dive onto it. The manta
  // is moving, so this is a closed loop: re-aim every frame from its live spot.
  await page.evaluate(() => {
    const g = window.__capy;
    const m = g.palawan.manta();
    g.capy.body.position.set(m.x, -1.0, m.z + 4);
    g.capy.body.velocity.set(0, 0, 0);
  });
  await page.waitForTimeout(400);

  // hold E to dive down to it
  await page.keyboard.down('KeyE');
  const trace = [];
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(100);
    const s = await page.evaluate(() => {
      const g = window.__capy;
      const m = g.palawan.manta();
      const p = g.capy.position;
      const d = Math.hypot(p.x - m.x, p.y - m.y, p.z - m.z);
      // steer toward it
      return { d: +d.toFixed(2), depth: +(g.capy.depth || 0).toFixed(2),
               carried: !!g.capy.carriedBy, my: +m.y.toFixed(2), py: +p.y.toFixed(2) };
    });
    trace.push(s);
    if (s.carried) break;
    // nudge the body straight at the manta — steering under water through the
    // real key set is a separate test; this one is about the ride
    await page.evaluate(() => {
      const g = window.__capy;
      const m = g.palawan.manta();
      const p = g.capy.body.position;
      const dx = m.x - p.x, dy = m.y - p.y, dz = m.z - p.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > 2.2) { p.x += dx / d * 0.9; p.y += dy / d * 0.9; p.z += dz / d * 0.9; }
    });
  }
  await page.keyboard.up('KeyE');
  out.steps.push({ approach: trace.slice(-6) });

  // now press E to take hold
  for (let i = 0; i < 30; i++) {
    const st = await page.evaluate(() => !!window.__capy.capy.carriedBy);
    if (st) break;
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(120);
    await page.evaluate(() => {
      const g = window.__capy;
      const m = g.palawan.manta();
      const p = g.capy.body.position;
      const dx = m.x - p.x, dy = m.y - p.y + 0.6, dz = m.z - p.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > 2.0) { p.x += dx / d * 0.8; p.y += dy / d * 0.8; p.z += dz / d * 0.8; }
    });
  }
  const grabbed = await page.evaluate(() => !!window.__capy.capy.carriedBy);
  out.steps.push({ grabbed: grabbed });

  // ride it, sampling the whole flight
  const ride = [];
  let shot = 0;
  for (let i = 0; i < 26; i++) {
    await page.waitForTimeout(1000);
    const s = await page.evaluate(() => {
      const g = window.__capy;
      const m = g.palawan.manta();
      const p = g.capy.position;
      return { t: +(g.state.time || 0).toFixed(1), carried: !!g.capy.carriedBy,
               mx: +m.x.toFixed(1), my: +m.y.toFixed(1), mz: +m.z.toFixed(1),
               px: +p.x.toFixed(1), py: +p.y.toFixed(1), pz: +p.z.toFixed(1),
               gap: +Math.hypot(p.x - m.x, p.y - m.y, p.z - m.z).toFixed(2),
               done: !!(g.state.tasks && g.state.tasks['the-manta']) };
    });
    ride.push(s);
    // a picture at the roll and at the breach
    if ((i === 8 || i === 18) && shot < 2) {
      shot++;
      await page.evaluate(async n => {
        const g = window.__capy;
        const d = g.canvas.toDataURL('image/png');
        await fetch('/shot?name=manta' + n, { method: 'POST', body: d });
      }, shot);
    }
    if (!s.carried && i > 3) break;
  }
  out.steps.push({ ride: ride });

  out.errors = await page.evaluate(() => window.__err.slice(0, 12));
  out.lastError = await page.evaluate(() => (window.__capy.state && window.__capy.state.lastError) || null);
  out.tasks = await page.evaluate(() => {
    const t = window.__capy.state.tasks || {};
    return Object.keys(t).filter(k => t[k]);
  });

  await page.evaluate(async o => {
    await fetch('/shot?name=manta-result.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
