async page => {
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    const done = Object.create(null);
    g.events.on('task:complete', p => { if (p && p.id) done[p.id] = true; });
    const errs = [];
    window.addEventListener('error', e => errs.push(String(e.message || e.error)));

    const b = document.querySelectorAll('.capyui-pick');
    if (b[0]) b[0].click();
    await sleep(400);
    g.biome.switchTo('venice');
    await sleep(300);
    const V = g.venice;
    for (let i = 0; i < 4000 && V.tide() < 0.98; i++) g.venice.update(1 / 6);

    const P = V.boardPath();
    const log = [];
    // Walk the chain by hand along the published centreline: this tests the
    // ROUTE and the run bookkeeping, not a bang-bang steering controller.
    for (let i = 0; i < P.length / 2; i++) {
      const x = P[i * 2], z = P[i * 2 + 1];
      const y = g.venice.terrainHeight(x, z) + 2.3;
      const bd = g.capy.body;
      bd.position.set(x, y, z); bd.velocity.set(0, 0, 0);
      bd.previousPosition.copy(bd.position); bd.interpolatedPosition.copy(bd.position);
      g.capy.position.set(x, y, z);
      await sleep(110);
      if (i % 3 === 0) {
        log.push(i + ':' + x.toFixed(0) + ',' + z.toFixed(0) +
                 (V.onBoards() ? '+' : '-'));
      }
      if (done['passerelle']) break;
    }
    return { done: !!done['passerelle'], samples: log.join(' '), errs,
             n: P.length / 2 };
  });
  await page.evaluate(async o => {
    await fetch('/shot?name=boards.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
