async page => {
  await page.waitForTimeout(1500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2000);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
    g.biome.switchTo('venice');
    // Long enough for the ARRIVAL card to have come and gone: the first cut
    // fired the chain two seconds in and photographed the incident card on top
    // of Sydney's place card, which is a probe artefact and looks like a bug.
    tick(60 * 14);
    const f = g.palAudit().found.filter(x => x.b === 'venice')[0];
    g.capy.body.position.set(f.x + 3, g.venice.terrainHeight(f.x + 3, f.z) + 0.4, f.z);
    g.capy.body.velocity.set(0, 0, 0);
    tick(60);
    const cp = g.capy.position;
    const at = { x: cp.x, y: cp.y, z: cp.z };
    g.events.emit('prop:impact', { position: at, speed: 0, spill: true,
                                   prop: { id: 801, type: 'coffee', disturbed: true } });
    tick(20);
    g.events.emit('prop:impact', { position: at, speed: 5.5,
                                   prop: { id: 802, type: 'bin', disturbed: true } });
    tick(20);
    g.events.emit('prop:impact', { position: at, speed: 5.5,
                                   prop: { id: 803, type: 'cone', disturbed: true } });
    tick(10);
    let alive = true;
    const loop = () => { if (!alive) return; requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    window.__pinStop = () => { alive = false; };
    tick(40);
    return { last: g.repDebug().last, counts: g.repDebug().counts };
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'qa/Q1-card.png' });
  await page.evaluate(() => { if (window.__pinStop) window.__pinStop(); });
  await page.evaluate((o) => fetch('/shot?name=q1-shot.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
