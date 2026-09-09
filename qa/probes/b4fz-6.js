async page => {
  const out = await page.evaluate(() => {
    const g = window.__capy, P = g.physics;
    const log = [];
    if (g.biome.current !== 'sydney') g.biome.switchTo('sydney');
    const sp = g.biome.spawnOf('sydney'), cb = g.capy.body;
    cb.position.set(sp.x, sp.y, sp.z); cb.velocity.set(0, 0, 0);
    cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position);
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
    const p = g.props.find(q => q.type === 'sandwich' && !q.removed && !q.hidden);
    if (!p) return { err: 'no sandwich' };
    // stand ON it, then grab
    cb.position.set(p.body.position.x + 0.35, p.body.position.y + 0.6, p.body.position.z);
    cb.velocity.set(0, 0, 0);
    cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position);
    for (let i = 0; i < 20; i++) g.tick(1 / 60, false);
    const grabbed = P.grab(p);
    log.push(['afterGrab', grabbed, !!p.held, g.capy.heldProp === p, +(g.capy.restT || 0).toFixed(2)]);
    let tHide = -1;
    for (let i = 0; i < 1200; i++) {
      g.tick(1 / 60, false);
      if (i % 120 === 0) log.push(['t' + (i / 60).toFixed(0), 'held', !!p.held, 'eaten', p.eaten || 0,
                                   'grazeT', +(p.grazeT || 0).toFixed(2), 'restT', +(g.capy.restT || 0).toFixed(2),
                                   'hidden', !!p.hidden]);
      if (p.hidden) { tHide = i / 60; break; }
    }
    const parked = [+p.body.position.x.toFixed(2), +p.body.position.y.toFixed(2), +p.body.position.z.toFixed(2)];
    const home = [+p.homeX.toFixed(2), +p.homeY.toFixed(2), +p.homeZ.toFixed(2)];
    const hiddenUntil = p.hiddenUntil, t0 = g.state.time;
    let backAt = -1;
    for (let i = 0; i < 60 * 90; i++) { g.tick(1 / 60, false); if (!p.hidden) { backAt = +(g.state.time - t0).toFixed(1); break; } }
    const afterWait = { hidden: !!p.hidden, backAt, simWaited: +(g.state.time - t0).toFixed(1),
                        hiddenUntil: +hiddenUntil.toFixed(1), timeAtHide: +t0.toFixed(1) };
    // and now the control: go to Pasto, where physPastoUpdate actually runs
    g.biome.switchTo('pasto');
    let pastoBack = -1;
    const t1 = g.state.time;
    for (let i = 0; i < 60 * 20; i++) { g.tick(1 / 60, false); if (!p.hidden) { pastoBack = +(g.state.time - t1).toFixed(1); break; } }
    return { grabbed, log, secondsToHide: +tHide.toFixed(2), parked, home, afterWait,
             pastoUnhidAfter: pastoBack, hiddenNow: !!p.hidden,
             pos: [+p.body.position.x.toFixed(2), +p.body.position.y.toFixed(2), +p.body.position.z.toFixed(2)] };
  });
  await page.evaluate(async o => {
    await fetch('/shot?name=b4fz-6.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out);
}
