async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(6500);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2000);
  const step = (body) => page.evaluate(new Function(`
    const g = window.__capy;
    const api = g.env, b = g.capy.body;
    function clr() { g.input.x = 0; g.input.z = 0; g.input.run = false; g.input.action = false;
      g.input.actionPressed = false; g.input.jump = false; g.input.jumpPressed = false; }
    function hold(n) { for (let i = 0; i < n; i++) g.tick(1/60, false); }
    ` + body));
  await step(`g.biome.switchTo('sydney'); hold(200); return g.biome.current;`);
  const wait = await step(`let n = 0; while (!api.vanParked() && n++ < 8000) g.tick(1/60,false); return n;`);
  const out = await step(`
    const v = api.van();
    b.position.set(v.x, 2.55, v.z); b.velocity.set(0,0,0); b.angularVelocity.set(0,0,0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    clr(); hold(90);
    const R = { mountY: +g.capy.position.y.toFixed(2), riding0: api.vanRiding(), rows: [] };
    for (let i = 0; i < 60 * 40; i++) {
      g.tick(1/60, false);
      if (i % 30 === 0) {
        const van = api.van(), p = g.capy.position;
        R.rows.push({ t: +(i / 60).toFixed(1), riding: api.vanRiding(), parked: api.vanParked(),
          dy: +(p.y - van.y).toFixed(2),
          dxz: +Math.hypot(p.x - van.x, p.z - van.z).toFixed(2),
          done: !!g.taskDone('whippy-run') });
      }
      if (g.taskDone('whippy-run')) break;
    }
    R.done = !!g.taskDone('whippy-run');
    R.rows = R.rows.slice(0, 40);
    return R;`);
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rv-van.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, { wait, out });
}
