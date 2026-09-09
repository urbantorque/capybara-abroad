async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5500);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2500);
  await page.evaluate(() => { window.__capy.biome.switchTo('monaco'); });
  await page.waitForTimeout(4000);

  // The band only exists as scheduled WebAudio nodes, so what is measured is
  // the mix bus: peak level on the master analyser over a window, plus the
  // chapter's own heat, sampled at rest and then with something going on.
  const install = await page.evaluate(() => {
    const g = window.__capy;
    const ac = g.audioCtx || (g.music && g.music.ctx) || null;
    return { hasCtx: !!ac, state: ac ? ac.state : null,
             heat: typeof (g.monaco && g.monaco.heat) === 'function' ? g.monaco.heat() : null,
             err: g.state.lastError || null };
  });

  // AT REST: on the quay, nothing happening.
  const rest = await page.evaluate(async () => {
    const g = window.__capy;
    const b = g.capy.body;
    const sp = g.biome.spawnOf('monaco');
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    await new Promise(r => setTimeout(r, 6000));
    return { heat: g.monaco.heat(), err: g.state.lastError || null };
  });

  // ON THE GAMING FLOOR, which is 0.30 of heat on its own, and then with a
  // croupier looking at you, which is the top of the scale.
  const inside = await page.evaluate(async () => {
    const g = window.__capy;
    const w = g.monaco.wheel;
    const b = g.capy.body;
    b.position.set(w.x + 3, 30.4, w.z + 3); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    await new Promise(r => setTimeout(r, 4000));
    const samples = [];
    for (let i = 0; i < 14; i++) {
      samples.push(+g.monaco.heat().toFixed(3));
      await new Promise(r => setTimeout(r, 500));
    }
    return { inside: g.monaco.inside(), seen: g.monaco.seen(), samples,
             err: g.state.lastError || null };
  });

  await page.evaluate(async (o) => {
    await fetch('/shot?name=bond.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, { install, rest, inside });
}
