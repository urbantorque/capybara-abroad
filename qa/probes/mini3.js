async page => {
  const out = await page.evaluate(async () => {
    const errs = [];
    const oldErr = console.error;
    console.error = function (...a) { errs.push(a.map(x => (x && x.stack) || String(x)).join(' ')); oldErr.apply(console, a); };
    window.addEventListener('error', e => errs.push('WINDOW ' + (e.message || e.error)));
    const g = window.__capy;
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const res = {};
    const btns = document.querySelectorAll('.capyui-pick');
    if (btns[0]) btns[0].click();
    await sleep(600);
    const done = Object.create(null);
    g.events.on('task:complete', p => { if (p && p.id) done[p.id] = true; });
    const down = k => window.dispatchEvent(new KeyboardEvent('keydown', { code: k, bubbles: true }));
    const up = k => window.dispatchEvent(new KeyboardEvent('keyup', { code: k, bubbles: true }));
    function place(x, y, z) {
      const b = g.capy.body;
      b.position.set(x, y, z); b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      g.capy.position.set(x, y, z);
    }

    // ---------------- RIO: the set ----------------
    g.biome.switchTo('rio');
    await sleep(500);
    const r = g.rio;
    res.hasFlow = typeof r.flow === 'function';
    // sit out the back, right where the peak stands up
    const w0 = r.waveAt();
    place(w0.x, 0.4, -56);
    await sleep(600);
    const samples = [];
    for (let i = 0; i < 900; i++) {
      await sleep(60);
      const cp = g.capy.position;
      const f = r.flow(cp.x, cp.z);
      if (i % 30 === 0) samples.push({ z: +cp.z.toFixed(1), wz: +r.waveAt().z.toFixed(1),
                                       fz: +f.z.toFixed(1), surf: r.surfing(), wet: +g.capy.wet.toFixed(2) });
      if (done['take-a-wave']) break;
      // paddle shoreward so we are in the band when it arrives
      if (cp.z < -50) { down('KeyW'); } else { up('KeyW'); }
    }
    up('KeyW');
    res.rioTicked = !!done['take-a-wave'];
    res.rioSamples = samples.slice(0, 22);
    res.rioEndZ = +g.capy.position.z.toFixed(1);

    // ---------------- ICELAND: the whale ----------------
    g.biome.switchTo('iceland');
    await sleep(500);
    const ic = g.iceland;
    res.hasWhale = typeof ic.whale === 'function';
    const pier = ic.pier;
    place(pier.x, 2.4, pier.z);
    await sleep(400);
    let guard = 0;
    while (!done['the-whale'] && guard++ < 1600) {
      await sleep(60);
      // stay put on the pier
      if (guard % 40 === 0) place(pier.x, 2.4, pier.z);
    }
    res.iceTicked = !!done['the-whale'];
    res.iceWait = (guard * 0.06).toFixed(0);

    // ---------------- MARRAKECH: the acrobats ----------------
    g.biome.switchTo('sahara');
    await sleep(500);
    const sa = g.sahara;
    const mat0 = sa.acrobatMat();
    res.mat = { x: +mat0.x.toFixed(1), y: +mat0.y.toFixed(2), z: +mat0.z.toFixed(1) };
    place(mat0.x, mat0.y + 0.4, mat0.z);
    await sleep(600);
    down('KeyE'); await sleep(90); up('KeyE');
    let top = 0;
    for (let i = 0; i < 220; i++) {
      await sleep(50);
      top = Math.max(top, g.capy.position.y - mat0.y);
      if (done['acrobats']) break;
    }
    res.sahTicked = !!done['acrobats'];
    res.sahTop = +top.toFixed(1);
    res.errs = errs;
    res.lastError = g.state && g.state.lastError;
    return res;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=mini3.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
