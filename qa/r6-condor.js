async page => {
  // ======================================================================
  // R6 — DOES THE CONDOR STING? Chapter 2 holds the steepest mechanic in the
  // game and it is the SECOND place a player sees. The batch says the sting is
  // softened "only if a scripted average-input run says it needs it", so this
  // is that run, and it is allowed to come back saying no.
  //
  // The hard task is `thermal-peak`: within 15 m of the caldera centre, above
  // the rim + 3 m, while hanging off the talons. The launch is ~104 m away, so
  // it wants a deliberate crossing and a climb.
  //
  // FOUR PILOTS. The first is the CALIBRATION and the reason to believe the
  // other three: pasto.js records that an unsteered bird "never came closer
  // than 95.4 m" over two minutes of flight. If the zero-input row does not
  // reproduce that, the instrument is measuring the harness, not the flight.
  //
  //   none    hands off the stick entirely
  //   naive   points at the mountain and holds it — no thermal craft at all
  //   average points at the mountain, re-aims five times a second with ~18 deg
  //           of aim error and a third of a second of reaction lag, flaps when
  //           it feels slow
  //   good    aims true, and circles once it is in lift
  //
  // PUMPED IN SLICES, NOT ONE EVALUATE. Hand-driven ticks run at many times
  // real time, but four pilots x four attempts x three minutes of game time is
  // tens of thousands of ticks and a single page.evaluate longer than ~20-30 s
  // dies with "Execution context was destroyed" (harness trap 2). The whole
  // run lives on window.__r6c and is advanced a bounded number of ticks at a
  // time from out here.
  // ======================================================================
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  const out = { pilots: [] };
  const PILOTS = ['none', 'naive', 'average', 'good'];

  const install = function (kind) {
    return page.evaluate(function (kind) {
      const g = window.__capy, D = 1 / 60;
      const P = g.pasto, C = g.condor;
      const cc = P.craterCentre;
      const inp = g.input;

      let seed = (2200 + kind.length * 97) >>> 0;
      const rnd = function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      let spare = null;
      const gauss = function () {
        if (spare !== null) { const s = spare; spare = null; return s; }
        let u = 0; do { u = rnd(); } while (u <= 1e-9);
        const v = rnd(), r = Math.sqrt(-2 * Math.log(u)), t = 2 * Math.PI * v;
        spare = r * Math.sin(t); return r * Math.cos(t);
      };

      const AIM_ERR = { none: 0, naive: 0.10, average: 0.31, good: 0.04 };   // rad, 1 sigma
      const REAIM   = { none: 0, naive: 0.90, average: 0.20, good: 0.12 };   // s between corrections
      const LAG     = { none: 0, naive: 0.55, average: 0.32, good: 0.14 };   // s of reaction delay

      const taskDone = function (id) {
        if (g.hud && g.hud.isTaskDone) return !!g.hud.isTaskDone(id);
        return !!(g.taskDone && g.taskDone(id));
      };

      const R = {
        kind: kind, attempts: 0, mounted: false, rideT: 0,
        peak: false, tPeak: -1, maxAGL: 0, minDist: 1e9, maxY: -1e9,
        rides: [],                       // one line per attempt: how it ended
        craterY: cc ? +cc.y.toFixed(1) : -1, launchDist: -1, err: null
      };

      // The pilot's hands. camYaw is held at 0 so input.x/z ARE world axes —
      // the stick is camera-relative and a drifting camera would add a second,
      // unmodelled error on top of the one being varied deliberately.
      let aimT = 0, cmdX = 0, cmdZ = 0, flapT = 0, lagBuf = [];
      let phase = 'reset', phaseT = 0, att = 0, rideT = 0, done = false;

      const clearHands = function () {
        inp.x = 0; inp.z = 0; inp.run = false; inp.camYaw = 0;
        inp.action = false; inp.actionPressed = false;
        inp.jump = false; inp.jumpPressed = false;
        inp.honk = false; inp.honkPressed = false;
      };

      const startAttempt = function () {
        att++; R.attempts = att;
        if (C.mounted && C.release) C.release();
        const sp = g.biome.spawnOf('pasto'), b = g.capy.body;
        b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0);
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
        phase = 'reset'; phaseT = 0;
      };
      startAttempt();

      window.__r6c = {
        get state() { return { phase: phase, att: att, done: done, R: R }; },
        pump: function (n) {
          for (let i = 0; i < n && !done; i++) {
            clearHands();

            if (phase === 'reset') {
              // wait for the previous bird to clear out — 12 s is plenty and an
              // unbounded wait would eat the whole slice budget
              if (C.state === 'gone' || phaseT > 12) {
                C.summon(); phase = 'summon'; phaseT = 0;
              }
            } else if (phase === 'summon') {
              if (Math.abs(phaseT - 5) < D * 0.6) C.summon();   // the taught second whistle
              if (C.talonInReach()) {
                inp.action = true; inp.actionPressed = true;
                phase = 'grab'; phaseT = 0;
              } else if (phaseT > 45) {
                R.rides.push({ att: att, end: 'never-in-reach', t: 0 });
                if (att >= 4) { done = true; } else startAttempt();
              }
            } else if (phase === 'grab') {
              if (phaseT > 0.5) {
                if (C.mounted) {
                  R.mounted = true;
                  const p0 = g.capy.body.position;
                  if (R.launchDist < 0) {
                    R.launchDist = +Math.sqrt((p0.x - cc.x) * (p0.x - cc.x) +
                                              (p0.z - cc.z) * (p0.z - cc.z)).toFixed(1);
                  }
                  phase = 'fly'; phaseT = 0; rideT = 0;
                  aimT = 0; lagBuf = []; cmdX = 0; cmdZ = 0; flapT = 0;
                } else {
                  R.rides.push({ att: att, end: 'grab-failed', t: 0 });
                  if (att >= 4) { done = true; } else startAttempt();
                }
              }
            } else if (phase === 'fly') {
              if (!C.mounted) {
                R.rides.push({ att: att, end: 'dropped', t: +rideT.toFixed(1) });
                if (att >= 4) { done = true; } else startAttempt();
              } else {
                const p = g.capy.body.position;
                const dx = cc.x - p.x, dz = cc.z - p.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                if (dist < R.minDist) R.minDist = +dist.toFixed(1);
                const agl = p.y - P.terrainHeight(p.x, p.z);
                if (agl > R.maxAGL) R.maxAGL = +agl.toFixed(1);
                if (p.y > R.maxY) R.maxY = +p.y.toFixed(1);

                if (kind !== 'none') {
                  aimT -= D;
                  if (aimT <= 0) {
                    aimT = REAIM[kind];
                    let a = Math.atan2(dx, dz) + gauss() * AIM_ERR[kind];
                    // ...and a pilot who has found lift STAYS in it. This is the
                    // one piece of flight craft the 'good' pilot has and the
                    // others do not: the game teaches thermals with a visible
                    // column of motes, and reading that is the skill the chapter
                    // is asking for. Bank across the target rather than at it.
                    if (kind === 'good' && g.capy.body.velocity.y > 0.6 && dist < 40) a += 1.1;
                    lagBuf.push({ x: Math.sin(a), z: Math.cos(a), t: LAG[kind] });
                  }
                  for (let k = lagBuf.length - 1; k >= 0; k--) {
                    lagBuf[k].t -= D;
                    if (lagBuf[k].t <= 0) {
                      cmdX = lagBuf[k].x; cmdZ = lagBuf[k].z;
                      lagBuf.splice(0, k + 1); break;
                    }
                  }
                  inp.x = cmdX; inp.z = cmdZ;
                  flapT -= D;
                  if ((kind === 'average' || kind === 'good') && flapT <= 0) {
                    const v = g.capy.body.velocity;
                    const s2 = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
                    if (s2 < 9.5) { inp.honk = true; inp.honkPressed = true; flapT = 1.6; }
                  }
                }
                rideT += D; R.rideT = +(R.rideT + D).toFixed(2);
                if (rideT > 100) {
                  R.rides.push({ att: att, end: 'timeout', t: +rideT.toFixed(1) });
                  if (att >= 4) { done = true; } else startAttempt();
                }
              }
            }

            g.tick(D, false);
            phaseT += D;

            if (!R.peak && taskDone('thermal-peak')) {
              R.peak = true; R.tPeak = +rideT.toFixed(1);
              R.rides.push({ att: att, end: 'peak', t: +rideT.toFixed(1) });
              done = true;
            }
            if (g.state.lastError) { R.err = String(g.state.lastError); done = true; }
          }
          clearHands();
          return { phase: phase, att: att, done: done };
        },
        finish: function () {
          clearHands();
          if (C.mounted && C.release) C.release();
          if (R.minDist > 1e8) R.minDist = -1;
          R.err = g.state.lastError ? String(g.state.lastError) : R.err;
          return R;
        }
      };
      return true;
    }, kind);
  };

  for (let pi = 0; pi < PILOTS.length; pi++) {
    if (pi > 0) {
      // thermal-peak is a task and it SAVES, so every pilot after the first
      // would read it done on frame 0. R3's pagehide flush means the clean
      // start is reload, THEN clear, THEN reload — see qa/r5-touch.js.
      await page.reload();
      await wait(4500);
      await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    }
    await page.reload();
    await wait(6500);
    await page.keyboard.press('Digit2');
    await wait(6000);
    await install(PILOTS[pi]);

    // ~2000 ticks a slice: 33 s of game time, comfortably inside the context
    // budget even when a frame is doing real physics work.
    let st = null;
    for (let k = 0; k < 40; k++) {
      st = await page.evaluate(() => window.__r6c.pump(2000));
      if (st.done) break;
    }
    const row = await page.evaluate(() => window.__r6c.finish());
    row.slices = st ? st.att : -1;
    out.pilots.push(row);
  }

  const b = await page.evaluate(o =>
    btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=r6-condor.json', { method: 'POST', body: s }), b);
}
