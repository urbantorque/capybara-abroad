// Chapter-3 loop driver. Loaded into the live page by the integrator.
// Every phase is a small, separately-callable method so a browser-pane drop
// only costs a re-load of this file, not the whole investigation.
(function () {
  const g = window.__capy;
  const QA = window.QA = { R: {}, T: [], errs: [] };

  // ---- error capture -------------------------------------------------------
  const oe = console.error.bind(console);
  console.error = function (...a) {
    try { QA.errs.push(a.map(x => (x && x.stack) ? x.stack : String(x)).join(' ').slice(0, 240)); } catch (e) {}
    return oe(...a);
  };
  window.addEventListener('error', e => QA.errs.push('WINERR ' + e.message));

  // ---- input plumbing ------------------------------------------------------
  const key = (c, t) => window.dispatchEvent(new KeyboardEvent(t || 'keydown', { code: c, key: c, bubbles: true, cancelable: true }));
  QA.key = key;
  QA.tick = n => { for (let i = 0; i < (n || 1); i++) g.tick(1 / 60, false); };
  QA.tap = c => { key(c, 'keydown'); g.tick(1 / 60, false); key(c, 'keyup'); };
  QA.errText = () => {
    const e = document.getElementById('err');
    return { display: getComputedStyle(e).display, text: e.textContent.slice(0, 300) };
  };

  // ---- teleport the capybara (QA only — stands in for a long walk) ---------
  QA.tp = function (x, z, dy) {
    const b = g.capy.body;
    const y = g.pasto.terrainHeight(x, z) + (dy === undefined ? 1.2 : dy);
    b.position.set(x, y, z);
    b.velocity.set(0, 0, 0);
    b.angularVelocity.set(0, 0, 0);
    b.previousPosition.copy(b.position);
    b.interpolatedPosition.copy(b.position);
    QA.tick(10);
    return [+x.toFixed(1), +y.toFixed(1), +z.toFixed(1)];
  };

  // ---- walk under player control toward x,z --------------------------------
  QA.walk = function (x, z, maxFrames) {
    const b = g.capy.body;
    for (let i = 0; i < (maxFrames || 600); i++) {
      const dx = x - b.position.x, dz = z - b.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.2) return { arrived: true, frames: i, d: +d.toFixed(2) };
      g.tick(1 / 60, false);
      g.input.camYaw = 0; g.input.x = dx / d; g.input.z = dz / d; g.input.run = true;
    }
    g.input.x = 0; g.input.z = 0; g.input.run = false;
    const d = Math.hypot(x - b.position.x, z - b.position.z);
    return { arrived: false, frames: maxFrames || 600, d: +d.toFixed(2) };
  };

  // ---- boot ----------------------------------------------------------------
  QA.boot = function () {
    const ct = g.completeTask.bind(g);
    g.completeTask = function (id) { if (QA.T.indexOf(id) < 0) QA.T.push(id); return ct(id); };
    key('Space', 'keydown'); key('Space', 'keyup');
    QA.tick(30);
    if (g.biome.current !== 'pasto') QA.tap('Backslash');
    QA.tick(60);
    return { started: g.state.started, biome: g.biome.current, crater: g.pasto.craterCentre.toArray().map(v => +v.toFixed(2)), errs: QA.errs.length };
  };

  // ---- 1/2/3: summon, second whistle, mount --------------------------------
  QA.summon = function () {
    QA.tap('KeyF');
    let t = 0; while (g.condor.state !== 'circling' && t < 900) { g.tick(1 / 60, false); t++; }
    return QA.R.s1 = { state: g.condor.state, secs: +(t / 60).toFixed(1), task_whistle_condor: QA.T.includes('whistle-condor') };
  };
  QA.lower = function () {
    const a = g.condor.body.position.y - g.capy.body.position.y;
    QA.tap('KeyF'); QA.tick(180);
    const b = g.condor.body.position.y - g.capy.body.position.y;
    return QA.R.s2 = { relY_before: +a.toFixed(1), relY_after: +b.toFixed(1), lowered: b < a, state: g.condor.state };
  };
  QA.mount = function () {
    let m = 0;
    while (g.condor.state !== 'carrying' && m < 600) {
      key('KeyE', 'keydown'); g.tick(1 / 60, false); key('KeyE', 'keyup'); g.input.actionPressed = true; m++;
    }
    g.input.actionPressed = false; g.input.action = false;
    return QA.R.s3 = { state: g.condor.state, mounted: g.condor.mounted, secs: +(m / 60).toFixed(1), task_condor_ride: QA.T.includes('condor-ride') };
  };

  // ---- 4/5: thermal hop to the crater rim ----------------------------------
  // Waypoints are the published pasto.thermals: plaza column -> east flank -> crater.
  QA.WP = [{ x: 13, z: 37, r: 13, to: 40 }, { x: 0, z: -70, r: 16, to: 66 }, { x: -40, z: -70, r: 22, to: 52 }];
  QA.wi = 0;
  QA.fly = function (n) {
    let maxY = -99, rel = null;
    for (let i = 0; i < n; i++) {
      const p = g.condor.body.position;
      let wp = QA.WP[QA.wi];
      let dx = wp.x - p.x, dz = wp.z - p.z, d = Math.hypot(dx, dz);
      if (d < wp.r * 0.85 && p.y >= wp.to && QA.wi < QA.WP.length - 1) {
        QA.wi++; wp = QA.WP[QA.wi]; dx = wp.x - p.x; dz = wp.z - p.z; d = Math.hypot(dx, dz);
      }
      let ux, uz;
      if (d < wp.r * 0.85) {                       // circle the column
        const a = Math.atan2(p.z - wp.z, p.x - wp.x);
        const kx = -Math.sin(a) - 0.45 * Math.cos(a), kz = Math.cos(a) - 0.45 * Math.sin(a);
        const m = Math.hypot(kx, kz); ux = kx / m; uz = kz / m;
      } else { ux = dx / d; uz = dz / d; }
      g.tick(1 / 60, false);
      g.input.camYaw = 0; g.input.x = ux; g.input.z = uz;
      g.input.actionPressed = false; g.input.whistlePressed = false; g.input.action = false; g.input.whistle = false;
      if (p.y > maxY) maxY = p.y;
      if (!rel && g.condor.state !== 'carrying') rel = { f: i, y: +p.y.toFixed(1), wi: QA.wi };
      if (QA.T.includes('thermal-peak')) {
        return QA.R.s4 = { peak: true, frames: i, capyY: +g.capy.body.position.y.toFixed(1), maxCondorY: +maxY.toFixed(1), wi: QA.wi };
      }
    }
    const p = g.condor.body.position;
    return { peak: false, wi: QA.wi, maxY: +maxY.toFixed(1), y: +p.y.toFixed(1), state: g.condor.state, rel,
             pos: [+p.x.toFixed(0), +p.z.toFixed(0)], capyY: +g.capy.body.position.y.toFixed(1) };
  };

  // ---- 6: release ----------------------------------------------------------
  QA.release = function () {
    const before = g.condor.state;
    key('KeyE', 'keydown'); g.tick(1 / 60, false); key('KeyE', 'keyup');
    g.input.actionPressed = true; g.tick(1 / 60, false); g.input.actionPressed = false;
    QA.tick(120);
    return QA.R.s6 = { before, after: g.condor.state, mounted: g.condor.mounted,
                       capy: g.capy.body.position.toArray().map(v => +v.toFixed(1)) };
  };

  // ---- 7: steal an empanada ------------------------------------------------
  QA.empanada = function () {
    const list = g.props.filter(p => p.type === 'empanada' && !p.removed);
    if (!list.length) return QA.R.s7 = { found: 0, task: false, why: 'no empanada prop in world' };
    const p = list[0];
    const wp = new g.THREE.Vector3(); p.mesh.getWorldPosition(wp);
    QA.tp(wp.x + 0.6, wp.z + 0.6, 0.9);
    let got = false;
    for (let i = 0; i < 90 && !got; i++) {
      key('KeyE', 'keydown'); g.tick(1 / 60, false); key('KeyE', 'keyup');
      got = !!(g.capy.heldProp);
    }
    return QA.R.s7 = { found: list.length, held: g.capy.heldProp ? g.capy.heldProp.type : null,
                       task_steal_empanada: QA.T.includes('steal-empanada') };
  };

  // ---- 8: collapse a stall -------------------------------------------------
  QA.stall = function () {
    const st = g.pasto.stalls[0];
    const ok = g.pasto.collapseStall(0);
    QA.tick(120);
    return QA.R.s8 = { called: ok, standing: st ? !!st.standing : null,
                       task_market_chaos: QA.T.includes('market-chaos') };
  };

  // ---- 9: drop something into the crater -----------------------------------
  QA.craterDrop = function () {
    const C = g.pasto.craterCentre;
    if (!g.capy.heldProp) {                       // grab anything if empty-mouthed
      const near = g.physics.nearestGrabbable(g.capy.body.position, 30);
      if (near) g.physics.grab(near);
    }
    const held = g.capy.heldProp ? g.capy.heldProp.type : null;
    QA.tp(C.x, C.z, 6);                            // stand over the vent
    key('KeyE', 'keydown'); g.tick(1 / 60, false); key('KeyE', 'keyup');
    g.input.actionPressed = true; g.tick(1 / 60, false); g.input.actionPressed = false;
    QA.tick(420);
    return QA.R.s9 = { dropped: held, stillHeld: !!g.capy.heldProp, task_crater_drop: QA.T.includes('crater-drop') };
  };

  // ---- 10: ring the church bell -------------------------------------------
  QA.bell = function () {
    const b = g.pasto.bell;
    if (!b || typeof b.ring !== 'function') return QA.R.s10 = { why: 'no bell api' };
    QA.tp(b.position.x, b.position.z + 2, 1.2);
    const ok = b.ring();
    QA.tick(240);
    return QA.R.s10 = { ringCalled: ok, task_church_bell: QA.T.includes('church-bell') };
  };

  // ---- 11: return to Sydney from the crater -------------------------------
  QA.home = function () {
    const C = g.pasto.craterCentre;
    QA.tp(C.x, C.z, 1.2);
    QA.tick(240);                                  // stand still so homeOk latches
    const zoneOk = g.pasto.inZone ? !!g.pasto.inZone('crater', g.capy.body.position.x, g.capy.body.position.z) : null;
    const grounded = g.capy.grounded;
    for (let w = 0; w < 3; w++) { QA.tap('KeyF'); QA.tick(20); }
    QA.tick(300);
    return QA.R.s11 = { zoneOk, grounded, biome: g.biome.current, arrivedSydney: g.biome.current === 'sydney',
                        capy: g.capy.body.position.toArray().map(v => +v.toFixed(1)) };
  };

  // ---- diagnostic: hold a fixed stick and watch the flight state ----------
  QA.probe = function (n, ix, iz) {
    const out = [];
    for (let i = 0; i < n; i++) {
      g.tick(1 / 60, false);
      g.input.camYaw = 0; g.input.x = ix; g.input.z = iz;
      g.input.actionPressed = false; g.input.whistlePressed = false; g.input.action = false; g.input.whistle = false;
      if (i % Math.ceil(n / 6) === 0) {
        const b = g.condor.body, v = b.velocity;
        out.push({ t: +(i / 60).toFixed(1), y: +b.position.y.toFixed(2),
                   sp: +Math.hypot(v.x, v.y, v.z).toFixed(1), vy: +v.y.toFixed(1),
                   x: +b.position.x.toFixed(0), z: +b.position.z.toFixed(0) });
      }
    }
    const b = g.condor.body;
    return { out, state: g.condor.state, terr: +g.pasto.terrainHeight(b.position.x, b.position.z).toFixed(2),
             seenInput: [g.input.x, g.input.z, g.input.camYaw] };
  };

  // ---- diagnostic: capture the exact launch transient ---------------------
  QA.launchProbe = function () {
    const CAN = g.CANNON;
    const fwd = new CAN.Vec3(), up = new CAN.Vec3();
    const rows = [];
    const snap = tag => {
      const b = g.condor.body, v = b.velocity;
      b.quaternion.vmult(new CAN.Vec3(0, 0, 1), fwd);
      b.quaternion.vmult(new CAN.Vec3(0, 1, 0), up);
      rows.push({ tag, y: +b.position.y.toFixed(2), vy: +v.y.toFixed(1),
                  sp: +Math.hypot(v.x, v.y, v.z).toFixed(1),
                  fwdY: +fwd.y.toFixed(2), upY: +up.y.toFixed(2),
                  state: g.condor.state });
    };
    snap('pre');
    let n = 0;
    while (g.condor.state !== 'carrying' && n < 600) {
      key('KeyE', 'keydown'); g.tick(1 / 60, false); key('KeyE', 'keyup'); g.input.actionPressed = true; n++;
    }
    g.input.actionPressed = false; g.input.action = false;
    snap('mounted+0');
    for (let i = 1; i <= 12; i++) {
      g.tick(1 / 60, false);
      g.input.x = 0; g.input.z = 0; g.input.actionPressed = false; g.input.whistlePressed = false;
      if (i % 3 === 0) snap('+' + i);
    }
    return rows;
  };

  // ---- diagnostic: how far apart are the two constraint anchors at grab? ---
  QA.gap = function () {
    const C = g.CANNON, cb = g.condor.body, kb = g.capy.body;
    const a = new C.Vec3(), b = new C.Vec3();
    cb.quaternion.vmult(new C.Vec3(0, -0.98, 0.04), a);
    kb.quaternion.vmult(new C.Vec3(0, 1.45 - 0.98, 0), b);
    const tw = [cb.position.x + a.x, cb.position.y + a.y, cb.position.z + a.z];
    const pw = [kb.position.x + b.x, kb.position.y + b.y, kb.position.z + b.z];
    return {
      state: g.condor.state,
      talonWorld: tw.map(v => +v.toFixed(2)),
      capyPivotWorld: pw.map(v => +v.toFixed(2)),
      constraintGapAtGrab: +Math.hypot(tw[0] - pw[0], tw[1] - pw[1], tw[2] - pw[2]).toFixed(2),
      talonToCapyCentre: +Math.hypot(tw[0] - kb.position.x, tw[1] - kb.position.y, tw[2] - kb.position.z).toFixed(2),
      condorAboveCapy: +(cb.position.y - kb.position.y).toFixed(2),
      omega: [+cb.angularVelocity.x.toFixed(1), +cb.angularVelocity.y.toFixed(1), +cb.angularVelocity.z.toFixed(1)]
    };
  };

  // ---- control experiment: grab with the anchors already coincident -------
  // Proves whether the tumble is the 3.6 m constraint violation or the aero model.
  QA.mountAligned = function () {
    const C = g.CANNON, cb = g.condor.body, kb = g.capy.body;
    const a = new C.Vec3(), b = new C.Vec3();
    cb.quaternion.vmult(new C.Vec3(0, -0.98, 0.04), a);
    kb.quaternion.vmult(new C.Vec3(0, 1.45 - 0.98, 0), b);
    kb.position.set(cb.position.x + a.x - b.x, cb.position.y + a.y - b.y, cb.position.z + a.z - b.z);
    kb.velocity.copy(cb.velocity);
    kb.previousPosition.copy(kb.position);
    kb.interpolatedPosition.copy(kb.position);
    const gap = QA.gap().constraintGapAtGrab;
    let n = 0;
    while (g.condor.state !== 'carrying' && n < 20) {
      key('KeyE', 'keydown'); g.tick(1 / 60, false); key('KeyE', 'keyup'); g.input.actionPressed = true; n++;
    }
    g.input.actionPressed = false; g.input.action = false;
    return { gapBeforeGrab: gap, state: g.condor.state, frames: n,
             omega: [+cb.angularVelocity.x.toFixed(1), +cb.angularVelocity.y.toFixed(1), +cb.angularVelocity.z.toFixed(1)] };
  };

  // ---- one-call setup: boot -> pasto -> summon -> lower -> aligned grab ----
  QA.setup = function () {
    const b = QA.boot(), s1 = QA.summon(), s2 = QA.lower(), s3 = QA.mountAligned();
    QA.wi = 0;
    return { biome: b.biome, s1: s1.state, s1task: s1.task_whistle_condor, s2: s2.lowered, s3: s3.state, gap: s3.gapBeforeGrab };
  };

  // ---- 5 (isolated): does the crater-rim detector fire when you are there? -
  // Separates "the peak detector works" from "you can fly there".
  QA.peak = function () {
    const C = g.pasto.craterCentre;
    const cb = g.condor.body, kb = g.capy.body;
    const y = C.y + 6;
    cb.position.set(C.x, y + 1.45, C.z); cb.velocity.set(6, 0, 0);
    kb.position.set(C.x, y, C.z); kb.velocity.set(6, 0, 0);
    [cb, kb].forEach(b => { b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position); });
    QA.tick(30);
    return QA.R.s5 = { state: g.condor.state, capyY: +kb.position.y.toFixed(1), rimY: +C.y.toFixed(2),
                       distToCentre: +Math.hypot(kb.position.x - C.x, kb.position.z - C.z).toFixed(1),
                       task_thermal_peak: QA.T.includes('thermal-peak') };
  };

  // ---- diagnostic: why did the empanada grab not fire? --------------------
  QA.propDump = function (type) {
    const V = new g.THREE.Vector3();
    const rows = g.props.filter(p => p.type === type).map(p => {
      p.mesh.getWorldPosition(V);
      return { grabbable: !!p.grabbable, held: !!p.held, removed: !!p.removed, hidden: !!p.hidden,
               owner: !!p.owner, pos: [+V.x.toFixed(1), +V.y.toFixed(1), +V.z.toFixed(1)],
               bodyY: +p.body.position.y.toFixed(1) };
    });
    const c = g.capy.body.position;
    const n = g.physics.nearestGrabbable(c, 3);
    return { rows, capy: [+c.x.toFixed(1), +c.y.toFixed(1), +c.z.toFixed(1)],
             nearest: n ? n.type : null, held: g.capy.heldProp ? g.capy.heldProp.type : null };
  };

  // ---- 7 (retry): stand ON the prop's own height, not the terrain ---------
  QA.empanada2 = function () {
    const V = new g.THREE.Vector3();
    const list = g.props.filter(p => p.type === 'empanada' && !p.removed && p.grabbable && !p.owner);
    if (!list.length) return QA.R.s7 = { why: 'no free grabbable empanada', task: false };
    const p = list[0];
    p.mesh.getWorldPosition(V);
    const b = g.capy.body;
    b.position.set(V.x + 0.4, V.y, V.z + 0.4);
    b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    QA.tick(5);
    const near = g.physics.nearestGrabbable(b.position, 2.2);
    let got = false;
    for (let i = 0; i < 60 && !got; i++) {
      key('KeyE', 'keydown'); g.tick(1 / 60, false); key('KeyE', 'keyup');
      got = !!g.capy.heldProp;
    }
    return QA.R.s7 = { candidates: list.length, nearestSeen: near ? near.type : null,
                       held: g.capy.heldProp ? g.capy.heldProp.type : null,
                       task_steal_empanada: QA.T.includes('steal-empanada') };
  };

  // hold a key down for n frames, then release (grab has a windup that is
  // cancelled the moment input.action goes false — capybara.js:649)
  QA.hold = function (c, n) {
    key(c, 'keydown');
    for (let i = 0; i < n; i++) g.tick(1 / 60, false);
    key(c, 'keyup');
    g.tick(1 / 60, false);
  };

  // ---- 7 (correct input): hold E to complete the grab windup --------------
  QA.empanada3 = function () {
    const V = new g.THREE.Vector3();
    const list = g.props.filter(p => p.type === 'empanada' && !p.removed && p.grabbable && !p.owner);
    if (!list.length) return QA.R.s7 = { why: 'no free grabbable empanada' };
    const p = list[0];
    p.mesh.getWorldPosition(V);
    const b = g.capy.body;
    b.position.set(V.x + 0.4, V.y, V.z + 0.4);
    b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    QA.tick(5);
    QA.hold('KeyE', 45);
    return QA.R.s7 = { candidates: list.length, held: g.capy.heldProp ? g.capy.heldProp.type : null,
                       task_steal_empanada: QA.T.includes('steal-empanada') };
  };

  // ---- 9 (correct input): carry a prop over the vent and let go ----------
  QA.craterDrop2 = function () {
    const C = g.pasto.craterCentre;
    const held = g.capy.heldProp ? g.capy.heldProp.type : null;
    if (!held) return QA.R.s9 = { why: 'nothing in mouth to post' };
    const b = g.capy.body;
    b.position.set(C.x, C.y + 8, C.z);
    b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    QA.tick(5);
    QA.hold('KeyE', 3);                 // press-and-release = throw/drop
    QA.tick(420);
    return QA.R.s9 = { dropped: held, stillHeld: !!g.capy.heldProp,
                       task_crater_drop: QA.T.includes('crater-drop') };
  };

  // ---- diagnostic: why is the way-home prompt not arming? ----------------
  QA.homeDiag = function () {
    const C = g.pasto.craterCentre, b = g.capy.body;
    QA.tp(C.x, C.z, 1.2);
    QA.tick(240);
    const el = document.querySelector('.capyui-home');
    const dots = el ? el.querySelectorAll('*') : [];
    const snap = () => ({
      cls: el ? el.className : null,
      dots: [...dots].map(d => d.className.indexOf('on') >= 0 ? 1 : 0)
    });
    const before = snap();
    const seq = [];
    for (let w = 0; w < 4; w++) { QA.tap('KeyF'); QA.tick(20); seq.push(snap()); }
    QA.tick(300);
    return {
      capy: [+b.position.x.toFixed(1), +b.position.y.toFixed(1), +b.position.z.toFixed(1)],
      terrainAtCapy: +g.pasto.terrainHeight(b.position.x, b.position.z).toFixed(2),
      craterCentreY: +C.y.toFixed(2),
      aglNeededUnder: 3.5,
      inZoneCrater: g.pasto.inZone ? g.pasto.inZone('crater', b.position.x, b.position.z) : null,
      grounded: g.capy.grounded, condorMounted: g.condor.mounted, condorState: g.condor.state,
      promptBefore: before, promptAfterEachWhistle: seq, biome: g.biome.current
    };
  };

  // ---- 6 (precise): one E press, state sampled every frame ---------------
  QA.release2 = function () {
    const seq = [];
    key('KeyE', 'keydown');
    for (let i = 0; i < 40; i++) {
      g.tick(1 / 60, false);
      if (i === 0) key('KeyE', 'keyup');
      seq.push(g.condor.state[0] + (g.capy.carriedBy ? 'C' : '-'));
    }
    return QA.R.s6 = { seq: seq.join(' '), finalState: g.condor.state, mounted: g.condor.mounted,
                       capyY: +g.capy.body.position.y.toFixed(1) };
  };

  QA.summary = function () {
    return { R: QA.R, tasks: QA.T.slice(), errCount: QA.errs.length, errs: QA.errs.slice(0, 4), err: QA.errText() };
  };
})();
'QA loaded';
