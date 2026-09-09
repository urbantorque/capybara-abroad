// Agent D — NPC soak harness. QA only; not part of the bundle.
window.__soak = (function () {
  const G = window.__capy;
  const S = {};
  S.tele = function (x, z, yAdd) {
    const b = G.capy.body;
    const built = G.pasto && G.pasto.built && G.pasto.built();
    const y = (built && G.biome.current === 'pasto' ? G.pasto.terrainHeight(x, z) : 0) + (yAdd || 1.4);
    b.position.set(x, y, z); b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
  };
  S.run = function (n, dt) { dt = dt || 1 / 60; for (let i = 0; i < n; i++) G.tick(dt, false); };
  S.pas = function () { return G.npcs.filter(n => n.pasto); };
  S.syd = function () { return G.npcs.filter(n => !n.pasto); };
  S.gy = function (n) {
    if (G.biome.current !== 'pasto') return 0;
    const p = n.group.position;
    return +((n.yOff !== undefined ? n.yOff : p.y) - G.pasto.terrainHeight(p.x, p.z)).toFixed(2);
  };
  S.report = function () {
    return S.pas().map(n => {
      const p = n.group.position;
      return [n.id, n.state, +(n.stateT || 0).toFixed(1),
        +Math.hypot(p.x - n.home.x, p.z - n.home.z).toFixed(1), S.gy(n), n.grudge];
    });
  };
  S.stations = [['plaza', 0, 26], ['market', -14, 18], ['coffee', 50, 6], ['flank', -20, -45], ['rim', -29, -70]];
  S.leash = function (n) {
    return n.kind === 'abuela' ? 56 : n.kind === 'farmer' ? 26 : n.kind === 'streetdog' ? 35 :
      n.kind === 'llama' ? 24 : 30 + (n.grudge || 0) * 4;
  };
  S.soak = function (secPer, runs) {
    const per = {}, md = {}, mdy = {};
    for (let r = 0; r < (runs || 1); r++) for (const st of S.stations) {
      S.tele(st[1], st[2]);
      for (let i = 0; i < secPer * 60; i++) {
        G.tick(1 / 60, false);
        if (i % 6) continue;
        for (const n of S.pas()) {
          const k = n.id + '|' + n.state;
          if (!(per[k] >= (n.stateT || 0))) per[k] = n.stateT || 0;
          const p = n.group.position, d = Math.hypot(p.x - n.home.x, p.z - n.home.z);
          if (!(md[n.id] >= d)) md[n.id] = d;
          const dy = S.gy(n);
          if (!(Math.abs(mdy[n.id]) >= Math.abs(dy))) mdy[n.id] = dy;
        }
      }
    }
    return {
      longStates: Object.keys(per).filter(k => per[k] > 30).map(k => [k, +per[k].toFixed(1)]),
      overLeash: S.pas().filter(n => md[n.id] > S.leash(n) + 2).map(n => [n.id, +md[n.id].toFixed(1), S.leash(n)]),
      offGround: S.pas().filter(n => Math.abs(mdy[n.id]) > 0.35).map(n => [n.id, +mdy[n.id].toFixed(2)]),
      maxDy: Math.max.apply(null, Object.keys(mdy).map(k => Math.abs(mdy[k]))),
      maxD: Math.max.apply(null, Object.keys(md).map(k => md[k])),
      states: per
    };
  };
  S.trap = function (state, minT, cap, secPer, runs) {
    const out = [];
    for (let r = 0; r < (runs || 1) && out.length < cap; r++) for (const st of S.stations) {
      S.tele(st[1], st[2]);
      for (let i = 0; i < secPer * 60; i++) {
        G.tick(1 / 60, false);
        if (i % 60) continue;
        for (const n of S.pas()) {
          if (n.state === state && n.stateT > minT && out.length < cap) {
            const p = n.group.position;
            out.push([n.id, st[0], +n.stateT.toFixed(0), +p.x.toFixed(1), +p.z.toFixed(1),
              +Math.hypot(p.x - n.home.x, p.z - n.home.z).toFixed(1), +n.speed.toFixed(2),
              n.avoidStuck ? 1 : 0, n.avoidSide, +(n.pushT || 0).toFixed(1)]);
          }
        }
      }
    }
    return out;
  };
  // Drive the capybara bodily toward (tx,tz) at `spd` for `secs`, so capySpd is
  // real and the startle / cornered / plunge path actually fires.
  S.drive = function (tx, tz, secs, spd, onFrame) {
    const b = G.capy.body;
    const n = Math.round(secs * 60);
    for (let i = 0; i < n; i++) {
      let dx = tx - b.position.x, dz = tz - b.position.z;
      const l = Math.hypot(dx, dz) || 1;
      b.velocity.x = dx / l * (spd || 6);
      b.velocity.z = dz / l * (spd || 6);
      b.wakeUp();
      G.tick(1 / 60, false);
      if (onFrame) onFrame(i);
    }
  };
  // ---- Sydney -------------------------------------------------------------
  S.sydStations = [[0, 22], [0, 4], [36, 30], [-40, 20], [-20, -8], [30, 26], [-30, -6], [50, 40]];
  S.sydSoak = function (secPer, runs) {
    const per = {}, wet = {}, everWet = {};
    let maxWet = 0;
    for (let r = 0; r < (runs || 1); r++) for (const st of S.sydStations) {
      S.tele(st[0], st[1]);
      for (let i = 0; i < secPer * 60; i++) {
        G.tick(1 / 60, false);
        if (i % 6) continue;
        let n0 = 0;
        for (const n of S.syd()) {
          const k = n.kind + '|' + n.state;
          if (!(per[k] >= (n.stateT || 0))) per[k] = n.stateT || 0;
          if (n.state === 'swim' || n.state === 'plunge') { n0++; everWet[n.id] = (everWet[n.id] || 0) + 1; }
          if (n.group.position.z < -10.4 && n.state !== 'swim' && n.state !== 'plunge') {
            wet[n.id] = n.state + '@z' + n.group.position.z.toFixed(1);
          }
        }
        if (n0 > maxWet) maxWet = n0;
      }
    }
    const inWaterNow = S.syd().filter(n => n.state === 'swim' || n.state === 'plunge').map(n => n.id);
    const strandedNow = S.syd().filter(n => n.group.position.z < -10.2)
      .map(n => [n.id, n.state, +n.group.position.z.toFixed(1)]);
    return {
      longStates: Object.keys(per).filter(k => per[k] > 30).map(k => [k, +per[k].toFixed(1)]),
      swimMax: +(per['tourist|swim'] || 0).toFixed(1),
      plungeMax: +(per['tourist|plunge'] || 0).toFixed(1),
      everWetCount: Object.keys(everWet).length,
      everWet: Object.keys(everWet),
      maxConcurrentWet: maxWet,
      inWaterNow, strandedNow, leftOfWall: wet
    };
  };
  return S;
})();
'soak ready';
