async page => {
  const out = {};
  out.chips = await page.evaluate(() => {
    const g = window.__capy, P = g.physics;
    if (g.biome.current !== 'quay') g.biome.switchTo('quay');
    const sp = g.biome.spawnOf('quay'), cb = g.capy.body;
    cb.position.set(sp.x, sp.y, sp.z); cb.velocity.set(0, 0, 0);
    cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position);
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
    const ch = g.props.find(p => p.type === 'chips' && !p.removed);
    if (!ch) return { err: 'no chips prop in quay' };
    const home = [+ch.homeX.toFixed(2), +ch.homeY.toFixed(2), +ch.homeZ.toFixed(2)];
    // stand the animal next to the chips and pick them up
    cb.position.set(ch.body.position.x + 0.5, cb.position.y, ch.body.position.z);
    cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position);
    for (let i = 0; i < 10; i++) g.tick(1 / 60, false);
    const grabbed = P.grab(ch);
    // CARRY THEM OUT INTO THE OPEN, which is what the task asks for
    const dragX = ch.body.position.x + 14, dragZ = ch.body.position.z + 14;
    cb.position.set(dragX, cb.position.y, dragZ);
    cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position);
    // ...and now stand still, holding them, which is the whole of the graze
    let tHide = -1, bites = [], restT = 0;
    for (let i = 0; i < 900; i++) {              // 15 s
      g.tick(1 / 60, false);
      restT = g.capy.restT || 0;
      if (ch.eaten && bites[bites.length - 1] !== ch.eaten) bites.push(ch.eaten);
      if (ch.hidden && tHide < 0) { tHide = i / 60; break; }
    }
    const hiddenAt = [+ch.body.position.x.toFixed(1), +ch.body.position.y.toFixed(1), +ch.body.position.z.toFixed(1)];
    // ...and how long before the world puts them back, and WHERE
    let tBack = -1;
    for (let i = 0; i < 60 * 45; i++) {
      g.tick(1 / 60, false);
      if (!ch.hidden) { tBack = i / 60; break; }
    }
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false);
    const back = [+ch.body.position.x.toFixed(1), +ch.body.position.y.toFixed(2), +ch.body.position.z.toFixed(1)];
    return {
      grabbed, home, dragTo: [+dragX.toFixed(1), +dragZ.toFixed(1)],
      restTAtEnd: +restT.toFixed(2),
      secondsToHide: +tHide.toFixed(2), bites,
      hiddenAt, secondsToRestock: +tBack.toFixed(2), back,
      dragUndoneMetres: +Math.hypot(back[0] - dragX, back[2] - dragZ).toFixed(2),
      held: !!ch.held, capyHolds: !!(g.capy.heldProp),
    };
  });
  // and the same shape for every OTHER edible in the game
  out.edibleHideTime = await page.evaluate(() => {
    const g = window.__capy, P = g.physics;
    const r = {};
    for (const t of ['sandwich', 'chips', 'icecream', 'flower']) {
      const d = P.typeOf(t);
      r[t] = d ? { edible: !!d.edible, planted: !!d.planted } : null;
    }
    return r;
  });
  await page.evaluate(async o => {
    await fetch('/shot?name=b4fz-4.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out);
}
