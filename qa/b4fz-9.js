async page => {
  const out = {};
  // ---- 4. ROOM REVERB ACROSS BORDER CROSSINGS ----------------------------
  out.room = await page.evaluate(() => {
    const g = window.__capy, H = g.hud;
    const log = [];
    function settle(name, secs) {
      if (g.biome.current !== name) g.biome.switchTo(name);
      for (let i = 0; i < secs * 60; i++) g.tick(1 / 60, false);
      const a = H.roomAudit();
      return { biome: name, roomFor: a.biome, wet: +a.wet.toFixed(4), secs: +a.secs.toFixed(2), conv: a.conv };
    }
    log.push(['settle cave 8s', settle('cave', 8)]);
    // WET -> DRY, and how long the cave's tail stays on the beach
    g.biome.switchTo('manly');
    let lag = -1;
    for (let i = 0; i < 60 * 8; i++) {
      g.tick(1 / 60, false);
      const a = H.roomAudit();
      if (a.biome === 'manly' && lag < 0) lag = +(i / 60).toFixed(2);
    }
    log.push(['cave->manly, s until the IR is manly', lag, H.roomAudit()]);
    // DRY -> WET
    let lag2 = -1;
    g.biome.switchTo('cave');
    for (let i = 0; i < 60 * 8; i++) {
      g.tick(1 / 60, false);
      const a = H.roomAudit();
      if (a.biome === 'cave' && lag2 < 0) lag2 = +(i / 60).toFixed(2);
    }
    log.push(['manly->cave, s until the IR is cave', lag2, H.roomAudit()]);
    // ---- FIVE CROSSINGS IN A ROW, 0.25 s APART, BOTH DIRECTIONS ---------
    const chain = ['manly', 'cave', 'venice', 'kowloon', 'cave', 'manly'];
    const seen = [];
    for (const c of chain) {
      g.biome.switchTo(c);
      for (let i = 0; i < 15; i++) g.tick(1 / 60, false);
      const a = H.roomAudit();
      seen.push([c, a.biome, +a.wet.toFixed(4), +a.secs.toFixed(2)]);
    }
    // ...and does it CATCH UP once you stand still
    let settleT = -1;
    for (let i = 0; i < 60 * 12; i++) {
      g.tick(1 / 60, false);
      const a = H.roomAudit();
      if (a.biome === 'manly' && Math.abs(a.wet - 0.04) < 0.004) { settleT = +(i / 60).toFixed(2); break; }
    }
    log.push(['rapid chain', seen, 'caught up after s', settleT, H.roomAudit()]);
    return log;
  });
  // ---- 5. CALM AND CHAOS IN DELIBERATE CONFLICT --------------------------
  out.calm = await page.evaluate(() => {
    const g = window.__capy, H = g.hud;
    g.biome.switchTo('sydney');
    const sp = g.biome.spawnOf('sydney'), cb = g.capy.body;
    cb.position.set(sp.x, sp.y, sp.z); cb.velocity.set(0, 0, 0);
    cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position);
    const r = {};
    // (a) STAND ABSOLUTELY STILL INSIDE A CHASE
    g.state.chaos = 0;
    for (let i = 0; i < 60 * 24; i++) {
      if (i % 60 === 0) g.events.emit('npc:chase', {});   // keep musChaseT alive
      g.tick(1 / 60, false);
    }
    r.stillInsideChase = { calm: +H.calmAudit().calm.toFixed(3), chaos: +g.state.chaos.toFixed(3),
                           restT: +(g.capy.restT || 0).toFixed(1), heat: g.npcHeat ? g.npcHeat() : null };
    // (b) the same stillness with CHAOS pinned high
    g.state.chaos = 0.9;
    const ys = [];
    for (let i = 0; i < 60 * 8; i++) {
      g.state.chaos = 0.9;                                  // hold it there
      g.tick(1 / 60, false);
      if (i % 120 === 0) ys.push(+H.calmAudit().calm.toFixed(3));
    }
    r.stillUnderChaos = { calm: +H.calmAudit().calm.toFixed(3), trace: ys };
    // the exact chaos at which the field is fully suppressed
    g.state.chaos = 0;
    for (let i = 0; i < 60 * 20; i++) g.tick(1 / 60, false);
    const base = H.calmAudit().calm;
    const table = [];
    for (const ch of [0.2, 0.4, 0.6, 0.625, 0.7, 1.0]) {
      g.state.chaos = ch;
      for (let i = 0; i < 6; i++) { g.state.chaos = ch; g.tick(1 / 60, false); }
      table.push([ch, +H.calmAudit().calm.toFixed(3)]);
      g.state.chaos = 0;
      for (let i = 0; i < 60 * 22; i++) g.tick(1 / 60, false);
    }
    r.calmVsChaos = { settledBase: +base.toFixed(3), table };
    // (c) SPRINT THROUGH A CALM FIELD — how fast it collapses, and how far out
    g.state.chaos = 0;
    for (let i = 0; i < 60 * 25; i++) g.tick(1 / 60, false);
    const before = H.calmAudit().calm;
    const far = [+g.calm(sp.x, sp.z).toFixed(3), +g.calm(sp.x + 13, sp.z).toFixed(3),
                 +g.calm(sp.x + 26, sp.z).toFixed(3), +g.calm(sp.x + 60, sp.z).toFixed(3)];
    let collapse = -1;
    for (let i = 0; i < 60 * 6; i++) {
      // drive it: a real sprint, written as body velocity every frame
      g.capy.body.velocity.x = 7; g.capy.body.velocity.z = 0;
      g.tick(1 / 60, false);
      if (collapse < 0 && H.calmAudit().calm < 0.05) collapse = +(i / 60).toFixed(2);
    }
    r.sprint = { calmBefore: +before.toFixed(3), fieldByDistance_0_13_26_60: far,
                 calmAfter: +H.calmAudit().calm.toFixed(3), secondsToCollapse: collapse };
    return r;
  });
  await page.evaluate(async o => {
    await fetch('/shot?name=b4fz-9.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out);
}
