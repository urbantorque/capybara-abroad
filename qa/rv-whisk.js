async page => {
  await page.reload();
  await page.waitForTimeout(6500);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2000);
  const out = await page.evaluate(() => {
    const g = window.__capy;
    const api = g.kyoto, b = g.capy.body;
    g.biome.switchTo('kyoto');
    for (let i = 0; i < 220; i++) g.tick(1 / 60, false);
    const R = {};
    const w = api.bowl;
    const ty = api.terrainHeight(w.x, w.z);
    R.bowl = [w.x, w.z]; R.terrainY = +ty.toFixed(2);
    // drop the animal on the tea disc
    b.position.set(w.x + 3.6, ty + 1.6, w.z);
    b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    g.input.x = 0; g.input.z = 0; g.input.run = false;
    for (let i = 0; i < 90; i++) g.tick(1 / 60, false);
    R.landed = [+g.capy.position.x.toFixed(2), +g.capy.position.y.toFixed(2), +g.capy.position.z.toFixed(2)];
    // run laps: always steer at a point a quarter-turn ahead on the circle
    const samples = [];
    let maxTan = 0;
    for (let i = 0; i < 60 * 60; i++) {
      const p = g.capy.position;
      const dx = p.x - w.x, dz = p.z - w.z;
      const d = Math.hypot(dx, dz) || 1;
      const a = Math.atan2(dz, dx) + 0.9;      // a good way round the rim
      const rr = 4.2;
      const tx = w.x + Math.cos(a) * rr, tz = w.z + Math.sin(a) * rr;
      const ex = tx - p.x, ez = tz - p.z, e = Math.hypot(ex, ez) || 1;
      const cy = g.input.camYaw || 0;
      g.input.x = (ex / e) * Math.cos(cy) + (ez / e) * (-Math.sin(cy));
      g.input.z = -((ex / e) * (-Math.sin(cy)) + (ez / e) * (-Math.cos(cy)));
      g.input.run = true;
      g.tick(1 / 60, false);
      const v = b.velocity;
      const tanx = -dz / d, tanz = dx / d;
      const tan = Math.abs(v.x * tanx + v.z * tanz) * (d / 5.2);
      if (tan > maxTan) maxTan = tan;
      if (i % 300 === 0) samples.push({ i: i, r: +d.toFixed(2), tan: +tan.toFixed(2),
        y: +p.y.toFixed(2), done: !!g.taskDone('whisk-spin') });
      if (g.taskDone('whisk-spin')) break;
    }
    g.input.x = 0; g.input.z = 0; g.input.run = false;
    R.samples = samples;
    R.maxDrive = +maxTan.toFixed(2);
    R.done = !!g.taskDone('whisk-spin');
    R.end = [+g.capy.position.x.toFixed(2), +g.capy.position.y.toFixed(2), +g.capy.position.z.toFixed(2)];
    R.lastError = g.state.lastError || null;
    return R;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rv-whisk.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
