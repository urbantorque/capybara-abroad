async page => {
  const out = await page.evaluate(async () => {
    const errs = [];
    const oldErr = console.error;
    console.error = function (...a) { errs.push(a.map(x => (x && x.stack) || String(x)).join(' ')); oldErr.apply(console, a); };
    const g = window.__capy;
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const btns = document.querySelectorAll('.capyui-pick');
    if (btns[0]) btns[0].click();
    await sleep(500);
    const done = Object.create(null);
    g.events.on('task:complete', p => { if (p && p.id) done[p.id] = true; });
    g.biome.switchTo('goreme');
    await sleep(700);
    const go = g.goreme;
    const mp = go.mare();
    const b = g.capy.body;
    b.position.set(mp.x, mp.y + 2.0, mp.z); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    g.capy.position.copy(b.position);
    await sleep(500);
    const trail = [];
    for (let i = 0; i < 900; i++) {
      await sleep(60);
      if (i % 25 === 0) trail.push({ on: go.onMare(), run: go.mareRunning(),
                                     z: +go.mare().z.toFixed(0), my: +go.mare().y.toFixed(1),
                                     cy: +g.capy.position.y.toFixed(1) });
      if (done['the-herd']) break;
    }
    return { ticked: !!done['the-herd'], trail, errs, lastError: g.state && g.state.lastError };
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=gorherd.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, out);
}
