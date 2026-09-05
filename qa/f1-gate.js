async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await wait(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await wait(6500);
  await page.keyboard.press('Digit1');
  await wait(3000);
  const cross = n => page.evaluate(function (n) {
    const g = window.__capy;
    try { g.hud.cross(n); } catch (e) { g.biome.switchTo(n); }
    return true;
  }, n);
  const out = {};

  // ================= MONACO: the chicane is one you did ==================
  await cross('monaco'); await wait(9000);

  // (1) thirty seconds of arrival with no key ever pressed.
  out.monIdle = [];
  for (let i = 0; i < 6; i++) {
    await wait(5000);
    out.monIdle.push(await page.evaluate(() => {
      const g = window.__capy;
      const cs = (g.props || []).filter(p => p.biome === 'monaco' && p.type === 'cone' && p.body);
      let inWater = 0;
      for (const p of cs) if (p.body.position.y < -0.4) inWater++;
      return { t: +g.state.time.toFixed(1), inWater: inWater, done: g.taskDone('chicane') };
    }));
  }

  // (2) CONTROL: a cone goes in the basin with the animal thirty metres off.
  out.monControl = await page.evaluate(async () => {
    const g = window.__capy, api = g.monaco;
    const c0 = api.chicane();
    const cones = (g.props || []).filter(p => p.biome === 'monaco' && p.type === 'cone' && p.body &&
      Math.hypot(p.body.position.x - c0.x, p.body.position.z - c0.z) < 20);
    const p = cones[0];
    const capy = g.capy.body.position;
    const away = Math.hypot(capy.x - p.body.position.x, capy.z - p.body.position.z);
    p.body.wakeUp();
    p.body.velocity.set(0, 3.5, 9.5);
    await new Promise(r => setTimeout(r, 5000));
    return { animalWasAway: +away.toFixed(1),
             coneY: +p.body.position.y.toFixed(2), coneZ: +p.body.position.z.toFixed(2),
             done: g.taskDone('chicane') };
  });

  // (3) THE REAL CASE: stand next to a cone, then it goes in.
  out.monMine = await page.evaluate(async () => {
    const g = window.__capy, api = g.monaco;
    const c0 = api.chicane();
    const cones = (g.props || []).filter(p => p.biome === 'monaco' && p.type === 'cone' && p.body &&
      Math.hypot(p.body.position.x - c0.x, p.body.position.z - c0.z) < 20 &&
      p.body.position.y > -0.4);
    const p = cones[cones.length - 1];
    const b = p.body.position;
    // Stand the animal where a shove would put it: just inland of the cone.
    g.capy.body.position.set(b.x, b.y + 0.6, b.z - 1.1);
    g.capy.body.velocity.set(0, 0, 0);
    await new Promise(r => setTimeout(r, 1200));
    const near = Math.hypot(g.capy.position.x - b.x, g.capy.position.z - b.z);
    p.body.wakeUp();
    p.body.velocity.set(0, 3.5, 9.5);
    await new Promise(r => setTimeout(r, 5000));
    return { stoodAt: +near.toFixed(2),
             coneY: +p.body.position.y.toFixed(2), coneZ: +p.body.position.z.toFixed(2),
             done: g.taskDone('chicane') };
  });

  // ================= QUAY: the arrival is not the cast-off ===============
  await cross('quay'); await wait(9000);
  out.quayOnArrival = await page.evaluate(() => {
    const g = window.__capy;
    return { done: g.taskDone('to-quay'), takeHelm: g.taskDone('take-helm'),
             open: (document.querySelector('.capyui-todo') || {}).textContent.slice(0, 120) };
  });
  // ...and it ticks when she is genuinely off the wall.
  await page.evaluate(() => {
    const g = window.__capy, h = g.quay && g.quay.boat && g.quay.boat.helm;
    if (h) { g.capy.body.position.set(h.x, h.y + 0.8, h.z); g.capy.body.velocity.set(0, 0, 0); }
    return true;
  });
  await wait(1500);
  await page.keyboard.press('KeyE');
  await wait(1200);
  out.quayHelm = await page.evaluate(() => ({ atHelm: !!(window.__capy.capy || {}).atHelm }));
  await page.keyboard.down('KeyW');
  await wait(26000);
  await page.keyboard.up('KeyW');
  out.quayAfterRun = await page.evaluate(() => {
    const g = window.__capy;
    return { done: g.taskDone('to-quay'), takeHelm: g.taskDone('take-helm'),
             atHelm: !!(g.capy || {}).atHelm };
  });
  await page.screenshot({ path: 'qa/F1-quay-run.png' });

  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=f1-gate.json', { method: 'POST', body: s }), bl);
}
