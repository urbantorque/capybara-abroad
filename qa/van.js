async page => {
  const out = await page.evaluate(async () => {
    const errs = [];
    const oldErr = console.error;
    console.error = function (...a) { errs.push(a.map(x => (x && x.stack) || String(x)).join(' ')); oldErr.apply(console, a); };
    window.addEventListener('error', e => errs.push('WINDOW ' + (e.message || e.error)));
    const g = window.__capy;
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const res = { errs };
    const btns = document.querySelectorAll('.capyui-pick');
    if (btns[0]) btns[0].click();
    await sleep(600);

    const done = Object.create(null);
    g.events.on('task:complete', p => { if (p && p.id) done[p.id] = true; });

    const env = g.env;
    res.hasVan = typeof env.van === 'function';
    // Wait for her to leave the eastern terminus, then drop the animal on the roof.
    let guard = 0;
    while (env.vanParked() && guard++ < 700) await sleep(16);
    res.waited = guard;
    const v = env.van();
    const b = g.capy.body;
    b.position.set(v.x, 3.1, v.z);
    b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position);
    b.interpolatedPosition.copy(b.position);
    g.capy.position.set(v.x, 3.1, v.z);
    await sleep(400);
    res.onRoofAtStart = env.vanRiding();

    const samples = [];
    for (let i = 0; i < 130; i++) {
      await sleep(120);
      const p = g.capy.position, w = env.van();
      samples.push({ dy: +(p.y).toFixed(2), dxz: +Math.hypot(p.x - w.x, p.z - w.z).toFixed(2),
                     ride: env.vanRiding(), vx: +w.x.toFixed(1), vz: +w.z.toFixed(1) });
      if (done['whippy-run']) break;
    }
    res.ticked = !!done['whippy-run'];
    res.frames = samples.length;
    res.lost = samples.filter(s => !s.ride).length;
    res.first = samples[0];
    res.last = samples[samples.length - 1];
    res.minY = Math.min.apply(null, samples.map(s => s.dy));
    res.maxDxz = Math.max.apply(null, samples.map(s => s.dxz));
    res.lastError = g.state && g.state.lastError;
    return res;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=van-result.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
