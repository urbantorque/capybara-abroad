async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://localhost:5199/index.html');
  await page.waitForTimeout(7000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2500);
  const R = {};
  await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('drift');
    for (let i = 0; i < 180; i++) g.tick(1 / 60, false);
  });
  // ---- lampflies: wander the orchard, wheeking ------------------------
  R.flies = await page.evaluate(() => {
    const g = window.__capy; const A = g.drift; const b = g.capy.body;
    const o = A.orchard;
    const S = { steps: [] };
    for (let k = 0; k < 40 && A.lampflies() < A.lampfliesNeeded; k++) {
      const a = k * 2.39996;
      const x = o.x + Math.cos(a) * (3 + (k % 5) * 3);
      const z = o.z + Math.sin(a) * (3 + (k % 5) * 3);
      b.position.set(x, A.terrainHeight(x, z) + 0.4, z); b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      for (let i = 0; i < 40; i++) g.tick(1 / 60, false);
      g.input.honkPressed = true; g.tick(1 / 60, false);
      for (let i = 0; i < 20; i++) g.tick(1 / 60, false);
      if (k % 8 === 0) S.steps.push([k, A.lampflies()]);
    }
    S.awake = A.lampflies();
    S.need = A.lampfliesNeeded;
    S.lampfly = !!g.taskDone('lampfly');
    S.err = g.state.lastError || null;
    return S;
  });
  // ---- the lantern ----------------------------------------------------
  R.lantern = await page.evaluate(() => {
    const g = window.__capy; const A = g.drift; const b = g.capy.body;
    const L = A.lantern;
    b.position.set(L.x + 3, L.y + 0.6, L.z + 3); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false);
    const y0 = +g.capy.position.y.toFixed(2);
    g.input.actionPressed = true; g.tick(1 / 60, false);
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
    return { done: !!g.taskDone('lantern'), lit: !!A.lit(), y: y0,
             awake: A.lampflies(), err: g.state.lastError || null };
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rb-dri2a.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, R);
}
