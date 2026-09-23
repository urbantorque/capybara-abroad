async page => {
  const traceFall = process.env.CAPY_QA_TRACE_FALL === '1';
  // ---- IT STARTS THE GAME NOW ------------------------------------------
  // This assumed it was being run after something else had already booted and
  // pressed past the title card, and if it was not, all seventeen chapters came
  // back IDENTICAL — maxSpeed 0, the same end position to the decimetre, and no
  // errors, which reads as seventeen clean passes and is seventeen runs against
  // a title screen. A suite that cannot fail is worse than no suite.
  //
  // ---- ...AND IT REGRESSED TO EXACTLY THAT (L4, qa #1) --------------------
  // The fix above was `page.mouse.click(640, 400)`, and the title card's
  // pointerdown handler starts the game only when the press lands on the
  // BACKDROP — the click landed on the card, the eight random keys were
  // dropped by the `started` gate, and the L3 closeout's "fuzz clean in
  // nineteen chapters" was nineteen rows of maxSpeed 0 and stuckFrames 460
  // that nobody read. Three things, so it cannot happen a third time:
  //   1. Enter is the door (startResume, the same one the player uses).
  //   2. `started` is written into every row.
  //   3. The sweep FAILS — a `fail` list in the JSON and a thrown Error at
  //      the end, so run-code exits non-zero — when started is not true, or
  //      when any chapter's maxSpeed is under 1 m/s, or when any chapter has
  //      a NaN frame, a void fall or a lastError. A row with maxSpeed 0 is
  //      not a clean chapter, it is a harness that did not press anything.
  // `solverSaves` is a cumulative counter nothing resets, and the suite's
  // own keepsake teleport (950, 12, 950 reaching 90 m/s) was the source of
  // every clamp it reported — so it is read as a DELTA over the eight
  // seconds of input, and the teleport's own clamps are a separate column.
  // (L7, E7) the window of random keys per chapter. `npm run soak` wants 45 s
  // (the roadmap's own number); the assert-suite's callers want this file
  // fast, so the default stays 8 and qa/soak.mjs's stage() text-replaces this
  // exact line for its own run — the same substitution trick it already uses
  // for the port and the dist:// path.
  const sysFUZZ_SEC = 8;
  // A ceiling, not just the existing floor: `maxSpeed >= 1` below catches a
  // harness that pressed nothing, this catches the animal being LAUNCHED —
  // Monaco's pack car handed the solver 34-85 m/s before capy.velocity was
  // clamped (see monaco.js, monUpdateRide). Drift's vertical fall between
  // islands and Cappadocia's balloon are legitimately faster than a foot
  // chase; both get headroom rather than the general ceiling.
  const sysFUZZ_SPEED_MAX = 30;
  const sysFUZZ_SPEED_BY = { drift: 34, goreme: 50 };
  await page.goto('http://localhost:5188/index.html');
  await page.waitForTimeout(6000);
  await page.waitForFunction(() => window.__capy && (document.querySelector('.capyui-carry') || document.querySelector('.capyui-go')));
  await page.evaluate(() => {
    const free = document.querySelector('.capyui-go[data-free]');
    if (free) {
      free.click();
      const hero = document.querySelector('.capyui-pick.hero');
      if (!hero) throw new Error('free-roam Sydney door missing');
      hero.click();
    } else {
      const door = document.querySelector('.capyui-carry') || document.querySelector('.capyui-go');
      if (!door) throw new Error('start door missing');
      door.click();
    }
  });
  await page.keyboard.press('Shift'); // trusted input unlocks synthesized audio
  await page.waitForTimeout(3000);
  const started = await page.evaluate(() => !!(window.__capy && window.__capy.state.started));
  // Read the authored controller/solver rows; a changed row cannot silently
  // leave the fall classifier using an obsolete acceleration allowance.
  const fallPhysics = await page.evaluate(async () => {
    async function source(file) {
      const r = await fetch(file); if (!r.ok) throw Error('fall source unavailable: ' + file);
      return r.text();
    }
    const capy = await source('src/capybara.js'), main = await source('src/main.js');
    function value(text, name) {
      const m = text.match(new RegExp('const ' + name + '\\s*=\\s*([\\d.]+)(?:\\s*/\\s*([\\d.]+))?\\s*;'));
      if (!m) throw Error('fall physics row unavailable: ' + name);
      return Number(m[1]) / (m[2] ? Number(m[2]) : 1);
    }
    return { run: value(capy, 'capyRUN'), accel: value(capy, 'capyACCEL') * value(capy, 'capyAIR_CONTROL'),
      step: value(main, 'STEP') };
  });
  const names = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland',
                 'sahara', 'drift', 'venice', 'kowloon', 'palawan', 'goreme',
                 'manly', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi'];
  const res = {};
  for (const n of names) {
    res[n] = await page.evaluate(async ([name, fuzzSec, speedCap, fallPhysics, traceFall]) => {
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
      // FUZZ_FALL_BEGIN: pure, source-extracted by reimagine-fuzz-fall.mjs.
      function fuzzFallClassifier(cap, physics) {
        let previous = null, anchor = null, lastCertified = false;
        const out = { maxObservedSpeed: 0, maxUnexplainedSpeed: 0, unexplainedFrames: 0,
          certifiedFallFrames: 0, certifiedFallPeak: 0, unexplainedPolls: 0, certifiedPolls: 0,
          releases: 0, invalidations: {}, violations: [] };
        function invalidate(reason) {
          if (anchor) out.invalidations[reason] = (out.invalidations[reason] || 0) + 1;
          anchor = null; lastCertified = false; return reason;
        }
        function sample(s) {
          const finite = s.p.length === 3 && s.v.length === 3 && s.frame.length === 2 && s.motion.length === 3 &&
            [...s.p, ...s.v, ...s.frame, ...s.motion, s.t, s.wall, s.tick, s.gravity, s.steps, s.worldStep].every(Number.isFinite);
          const speed = finite ? Math.hypot(...s.v) : Infinity, h = finite ? Math.hypot(s.v[0], s.v[2]) : Infinity;
          const carried = s.carried || s.mounted, dt = previous ? s.t - previous.t : 0;
          let reason = 'no observed release', certified = false, releaseHandoff = false;
          const continuous = previous && s.tick === previous.tick + 1 && dt >= 0 && dt <= .05 &&
            s.wall >= previous.wall && s.wall - previous.wall <= 100 && s.steps >= 0 &&
            s.steps <= Math.ceil(dt / physics.step) + 1 && Number.isInteger(s.steps) &&
            s.worldStep - previous.worldStep === s.steps;
          const unsafe = !finite ? 'nonfinite' : s.blocked ? 'paused/hidden' :
            !continuous ? 'sampling gap' : s.contacts ? 'contact' : s.grounded ? 'grounded' :
            // Exponential platform decay never reaches exact zero.
            // The carrier leaves a decaying frame below 3e-6 m/s after
            // release; a hundredth of a millimetre per second is still
            // below one pixel over this whole flight.
            s.swimming ? 'swimming' : Math.hypot(...s.frame) > 1e-5 ? 'moving frame' :
            s.gravity <= 0 || (previous && s.gravity !== previous.gravity) ? 'gravity changed' : '';
          if (unsafe) reason = invalidate(unsafe);
          else if (carried) reason = invalidate('carried');
          else {
            // Sum actual solver velocity * fixed step. Two centimetres is a
            // whole-flight residual allowance, never a fresh allowance per tick.
            if (anchor) for (let i = 0; i < 3; i++) anchor.expected[i] += s.motion[i];
            const motionError = s.p.some((x, i) => Math.abs(x - previous.p[i] - s.motion[i]) > .02) ||
              (anchor && s.p.some((x, i) => Math.abs(x - anchor.expected[i]) > .02));
            if (motionError) reason = invalidate('position jump');
            else if (!anchor && previous.condorCarrier && previous.speed <= cap && speed <= cap && h <= cap &&
              !previous.blocked && !previous.contacts && !previous.grounded && !previous.swimming &&
              previous.impulseT === s.impulseT) {
              anchor = { p: s.p.slice(), expected: s.p.slice(), v: s.v.slice(), speed, h, t: s.t, gravity: s.gravity, impulseT: s.impulseT };
              releaseHandoff = true;
              out.releases++; reason = 'release anchor';
            }
            if (anchor) {
              const g = s.gravity, elapsed = s.t - anchor.t;
              // One solver step of phase error, not a per-sample energy budget.
              const tolerance = 2 * g * Math.abs(s.v[1]) * physics.step + (g * physics.step) ** 2 + .05;
              const energy = anchor.speed ** 2 + 2 * g * (anchor.p[1] - s.p[1]);
              const horizontal = Math.min(cap, Math.max(anchor.h, physics.run)) + .05;
              if (elapsed > 8) reason = invalidate('stale anchor');
              else if (s.impulseT !== anchor.impulseT) reason = invalidate('external impulse');
              // The talon-point velocity replaces the carried body's solver
              // velocity once. Pasto's witnessed handoff adds 0.7 m/s;
              // later ticks retain the controller's strict acceleration cap.
              else if (h > horizontal || h - previous.h > physics.accel * dt + (releaseHandoff ? .75 : .05))
                reason = invalidate('horizontal acceleration');
              else if (s.v[1] < anchor.v[1] - g * (elapsed + physics.step) - .05 ||
                s.v[1] < previous.v[1] - g * (dt + physics.step) - .05 ||
                // Talon-point velocity replaces the constrained body's solver
                // velocity at release. One gravity step plus 0.1 m/s covers
                // that handoff; later airborne ticks retain the 0.05 bound.
                s.v[1] > previous.v[1] + (releaseHandoff ? g * physics.step + .1 : .05))
                reason = invalidate('vertical impulse');
              else if (speed ** 2 > energy + tolerance) reason = invalidate('energy gain');
              else if (s.v[1] < 0 && s.p[1] <= anchor.p[1]) { certified = true; reason = 'certified release fall'; }
              else reason = 'not descending below release';
            }
          }
          out.maxObservedSpeed = Math.max(out.maxObservedSpeed, speed);
          if (speed > cap && certified) {
            out.certifiedFallFrames++; out.certifiedFallPeak = Math.max(out.certifiedFallPeak, speed);
          } else {
            out.maxUnexplainedSpeed = Math.max(out.maxUnexplainedSpeed, speed);
            if (speed > cap) {
              out.unexplainedFrames++;
              if (out.violations.length < 12) out.violations.push({ t: s.t, speed, p: s.p.slice(), v: s.v.slice(), reason,
                before: previous && { t: previous.t, p: previous.p.slice(), v: previous.v.slice(),
                  swimming: previous.swimming, grounded: previous.grounded, carried: previous.carried,
                  frame: previous.frame.slice(), contacts: previous.contacts, impulseT: previous.impulseT } });
            }
          }
          previous = { ...s, p: s.p.slice(), v: s.v.slice(), carried, speed, h };
          lastCertified = speed > cap && certified;
          return { certified: lastCertified, reason };
        }
        function poll(s) {
          const speed = Math.hypot(...s.v);
          if (!(speed > cap)) return;
          const matches = previous && s.observerActive && s.t === previous.t && s.worldStep === previous.worldStep &&
            s.wall >= previous.wall && s.wall - previous.wall <= 100 &&
            s.p.every((x, i) => x === previous.p[i]) && s.v.every((x, i) => x === previous.v[i]) &&
            s.frame.every((x, i) => x === previous.frame[i]) && s.gravity === previous.gravity &&
            !!(s.carried || s.mounted) === !!previous.carried && s.condorCarrier === previous.condorCarrier &&
            s.grounded === previous.grounded && s.swimming === previous.swimming &&
            s.blocked === previous.blocked && s.impulseT === previous.impulseT;
          if (matches && lastCertified) { out.certifiedPolls++; return; }
          out.unexplainedPolls++; out.maxUnexplainedSpeed = Math.max(out.maxUnexplainedSpeed, speed);
          if (out.violations.length < 12) out.violations.push({ t: s.t, speed, p: s.p.slice(), v: s.v.slice(), reason: 'uncertified poll' });
          invalidate('uncertified poll');
        }
        return { sample, poll, report: () => out };
      }
      // FUZZ_FALL_END
      const g = window.__capy;
      const errs = [];
      const oe = console.error;
      console.error = function (...a) { errs.push(a.map(x => (x && x.stack) || String(x)).join(' ')); oe.apply(console, a); };
      try {
      const KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyE', 'KeyQ', 'ShiftLeft'];
      const down = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }));
      const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }));
      g.biome.switchTo(name);
      const sp = g.biome.spawnOf(name), cb = g.capy.body;
      cb.position.set(sp.x, sp.y, sp.z); cb.velocity.set(0, 0, 0);
      cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position);
      await sleep(300);
      // deterministic-ish PRNG so a hit is reproducible
      let s = 1234567 ^ name.length * 7919;
      const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
      let nanFrames = 0, belowVoid = 0, minY = 1e9, maxY = -1e9, maxSpeed = 0;
      let peakState = null, groundMax = 0, airMax = 0;
      let camNaN = 0, stuckFrames = 0, lastX = 0, lastZ = 0;
      const held = new Set();
      const saves0 = g.state.solverSaves || 0;     // cumulative; see the header
      const t0 = performance.now();
      const fall = fuzzFallClassifier(speedCap, fallPhysics), rawTick = g.tick;
      const fallTrail = [], fallTrailMax = 180;
      let firstUnexplained = null;
      let fallTick = 0, fallContacts = false, fallSteps = 0;
      const fallMotion = [0, 0, 0];
      const fallContact = () => {
        fallSteps++;
        fallMotion[0] += cb.velocity.x * fallPhysics.step;
        fallMotion[1] += cb.velocity.y * fallPhysics.step;
        fallMotion[2] += cb.velocity.z * fallPhysics.step;
        for (const contact of g.world.contacts || []) if (contact.bi === cb || contact.bj === cb) fallContacts = true;
      };
      function fallState() {
        return { tick: fallTick, t: g.state.time, wall: performance.now(), steps: fallSteps,
          worldStep: g.world.stepnumber, motion: fallMotion.slice(),
          p: cb.position.toArray(), v: cb.velocity.toArray(), frame: [g.capy.frameVX ?? 0, g.capy.frameVZ ?? 0],
          gravity: -g.world.gravity.y, grounded: !!g.capy.grounded, swimming: !!g.capy.swimming,
          carried: !!g.capy.carriedBy, mounted: !!g.condor?.mounted,
          condorCarrier: !!g.condor && (g.condor.mounted || g.capy.carriedBy === g.condor), contacts: fallContacts,
          impulseT: g.capy.impulseT ?? null, blocked: !!g.state.paused || !!g.state.renderHold || document.hidden };
      }
      g.world.addEventListener('postStep', fallContact);
      const solverBodies = new Map();
      let observedSaves = saves0;
      function fallTickObserver(...args) {
        fallContacts = false; fallSteps = 0; fallMotion.fill(0);
        try { return rawTick.apply(this, args); } finally {
          fallTick++;
          const row = fallState(), verdict = fall.sample(row);
          if (traceFall) {
            fallTrail.push({ t: row.t, p: row.p, v: row.v, grounded: row.grounded,
              carried: row.carried, mounted: row.mounted, condorCarrier: row.condorCarrier,
              contacts: row.contacts, frame: row.frame, impulseT: row.impulseT,
              terrain: name === 'pasto' ? g.pasto?.terrainHeight?.(row.p[0], row.p[2]) ?? null : null,
              certified: verdict.certified, reason: verdict.reason });
            if (fallTrail.length > fallTrailMax) fallTrail.shift();
            if (!firstUnexplained && Math.hypot(...row.v) > speedCap && !verdict.certified)
              firstUnexplained = fallTrail.slice();
          }
          const saves = g.state.solverSaves || 0;
          if (saves > observedSaves) {
            // Post-clamp candidates, not a claim of exact pre-solver cause.
            // Only scan on an intervention; retain counts, not per-frame logs.
            for (const b of g.world.bodies) {
              const v = b.velocity;
              if (Math.hypot(v.x, v.y, v.z) < 89.99) continue;
              const old = solverBodies.get(b.id);
              if (old) { old.count++; continue; }
              const prop = g.props.find(p => p.body === b);
              solverBodies.set(b.id, { id: b.id, count: 1, mass: b.mass, type: b.type,
                p: b.position.toArray(), v: v.toArray(), shapes: b.shapes.map(s => s.type),
                prop: prop ? { type: prop.type, biome: prop.biome, keep: prop.keep } : null });
            }
          }
          observedSaves = saves;
        }
      }
      g.tick = fallTickObserver;
      try {
      while (performance.now() - t0 < fuzzSec * 1000) {
        if (rnd() < 0.09) {
          const k = KEYS[(rnd() * KEYS.length) | 0];
          if (held.has(k)) { up(k); held.delete(k); } else { down(k); held.add(k); }
        }
        await sleep(16);
        // THE BAG EATS THE KEYBOARD (L8, F2). A short E on the traveller — who
        // stands at the way mark in all nineteen chapters now — opens a card
        // that pauses the world and swallows every key but Escape, and this
        // loop never pressed Escape: from the chapter it happened in, every
        // later chapter read maxSpeed 0 ("no input reached the animal") with
        // the animal parked at the previous chapter's end point. Measured
        // three soaks running (18 Sep); the F4 fixup's stuck-`paused` story
        // was this. A player closes the card; so does the fuzz.
        if (g.state.paused && !document.hidden) { down('Escape'); up('Escape'); }
        const p = g.capy.position, v = g.capy.body.velocity, c = g.camera.position;
        if (!(p.x === p.x && p.y === p.y && p.z === p.z)) nanFrames++;
        if (!(v.x === v.x && v.y === v.y && v.z === v.z)) nanFrames++;
        if (!(c.x === c.x && c.y === c.y && c.z === c.z)) camNaN++;
        const terr = (g[name === 'sydney' ? 'env' : name] && g[name === 'sydney' ? 'env' : name].terrainHeight)
          ? g[name === 'sydney' ? 'env' : name].terrainHeight(p.x, p.z) : 0;
        if (p.y < (terr === terr ? terr : 0) - 8) belowVoid++;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
        const spd = Math.hypot(v.x, v.y, v.z); if (spd > maxSpeed) maxSpeed = spd;
        if (spd > speedCap) fall.poll({ ...fallState(), p: p.toArray(), v: v.toArray(), observerActive: g.tick === fallTickObserver });
        if (g.capy.grounded) groundMax = Math.max(groundMax, spd); else airMax = Math.max(airMax, spd);
        // Keep the cause visible when a ceiling trips: a released bird fall
        // and a grounded collision runaway need different repairs.
        if (!peakState || spd > peakState.speed) peakState = {
          speed: spd, t: g.state.time, p: p.toArray(), v: v.toArray(), terrain: terr,
          grounded: !!g.capy.grounded, swimming: !!g.capy.swimming, carried: !!g.capy.carriedBy,
          frame: [g.capy.frameVX, g.capy.frameVZ], bird: g.condor && {
            state: g.condor.state, mounted: g.condor.mounted,
            p: g.condor.body?.position.toArray(), v: g.condor.body?.velocity.toArray() }
        };
        if (Math.hypot(p.x - lastX, p.z - lastZ) < 0.004 && held.size) stuckFrames++;
        lastX = p.x; lastZ = p.z;
      }
      } finally {
        g.tick = rawTick; g.world.removeEventListener('postStep', fallContact);
        for (const k of held) up(k);
      }
      const fallSpeed = fall.report();
      if (traceFall) fallSpeed.firstUnexplainedTrail = firstUnexplained;
      maxSpeed = Math.max(maxSpeed, fallSpeed.maxObservedSpeed);
      for (const k of held) up(k);
      const saves1 = g.state.solverSaves || 0;     // read BEFORE the keepsake teleport
      // ---- ...AND THE THREE THINGS BATCH ONE ADDED (v23) -----------------
      // Every one of them is a state machine or a force that runs on every
      // frame in every chapter, so the fuzz is exactly where they belong.
      //   THE LOAF     must be finite, in range, and must be DOWN after eight
      //                seconds of random keys — an animal that sits down while
      //                being driven about is the bug this would catch.
      //   RETRIEVAL    no local may be steering for ever (§THE CATCH-ALL
      //                STATE): ownT is bounded by npcOWN_OUT_T + npcOWN_BACK_T.
      //   THE GUST     no prop may be further than physGUST_ROAM from its home
      //                on the wind's account, and none may be moving faster
      //                than the puff could ever have left it.
      const loaf = g.capy.loaf;
      const locals = (g.locals || []).filter(r => r.biome === name);
      let ownMax = 0, ownN = 0, ownDrift = 0;
      for (const r of locals) {
        if (r.own) { ownN++; ownMax = Math.max(ownMax, r.ownT || 0); }
        ownDrift = Math.max(ownDrift, Math.hypot(r.x - r.ax, r.z - r.az));
      }
      // ...and the gust one is UNTOUCHED props only. `homeX/homeZ` is where a
      // prop belongs and not where the player left it, so measuring every light
      // prop's distance from home measures the fuzz throwing things: it
      // reported 59.9 m in Sydney and 50.6 in Cali, neither of which the wind
      // did. `lastCapyTouch` is the causation ledger props.js already keeps.
      let roamMax = 0, roamN = 0;
      for (const pr of g.props) {
        if (pr.removed || pr.hidden || pr.held || pr.inWater) continue;
        if (pr.biome && pr.biome !== name) continue;
        if (pr.mass > 0.6) continue;
        if (pr.lastCapyTouch > -1e8 || pr.owner || pr.disturbed) continue;
        roamN++;
        roamMax = Math.max(roamMax, Math.hypot(pr.body.position.x - pr.homeX,
                                               pr.body.position.z - pr.homeZ));
      }
      // ---- ...AND THE FIVE THINGS BATCH FOUR ADDED (v27) -----------------
      // All five are per-frame or per-crossing machinery that exists in every
      // chapter, which is why they belong in the per-chapter sweep and not in
      // a probe of their own. Each is asserted on its SETUP as well as on its
      // result — a keepsake that was never made and a prop that was never
      // hidden both read as a pass otherwise.
      //
      //   THE KEEPSAKE RESCUE  a souvenir flung out of the world must come
      //                        back ON THE GROUND. `homeY` is a SURFACE
      //                        everywhere physRescue reads it, and the border
      //                        crossing writes the capybara's spawn body-centre
      //                        into it — so the rescue leaves the souvenir
      //                        hanging at hip height, ASLEEP, and it never
      //                        falls. Measured by comparing where it lies after
      //                        the crossing with where the rescue puts it.
      //   THE HIDDEN QUEUE     physHide parks a prop off-map on a timer and
      //                        physUnhide brings it back. Anything whose
      //                        `hiddenUntil` is in the past and is still hidden
      //                        is a prop the world has lost — which is every
      //                        grazed prop outside Pasto.
      //   THE ROOM             the convolver must end up in the chapter you are
      //                        actually standing in.
      //   THE PIN              capybara.js pins an idle animal to a point. A
      //                        position written from outside under capyPIN_MAX
      //                        is answered with -ex/dt, and that number is not
      //                        bounded by anything the walk cap can see.
      //   CALM UNDER A CHASE   the calm field is suppressed by `chaos` and by
      //                        nothing else, so it goes on accruing through a
      //                        chase. Reported, not asserted: it is a design
      //                        reading, and the number is the argument.
      let keepHover = 'no keepsake', keepRescues = 0;
      if (g.physics && typeof g.physics.spawnKeep === 'function') {
        // THIS CHAPTER'S KEEPSAKE, at this chapter's spawn — not Sydney's at
        // (0, 0). The hard-coded 'sydney' here meant the check spawned the
        // WRONG chapter's souvenir at an arbitrary point in all nineteen
        // worlds, so what it measured was "can a plaque be rescued onto the
        // origin of Monte Carlo", which nothing in the game ever asks. It read
        // 3.41 m in monaco and 0.34 for the chapter's real keepsake in its real
        // place. The per-chapter numbers it produced were not meaningless —
        // the terrain under (0, 0) does differ — but they were not about the
        // souvenir the player carries either.
        const sp = g.biome.spawnOf(name);
        const kp = g.physics.keepOut(name) || g.physics.spawnKeep(name, sp.x, sp.z);
        if (kp) {
          for (let i = 0; i < 90; i++) g.tick(1 / 60, false);
          const restY = kp.body.position.y;
          kp.body.wakeUp();
          kp.body.position.set(950, 12, 950);           // outside physESCAPE_R2
          kp.body.velocity.set(0, 0, 0);
          kp.body.angularVelocity.set(0, 0, 0);
          kp.body.previousPosition.copy(kp.body.position);
          kp.body.interpolatedPosition.copy(kp.body.position);
          let lx = 950, ly = 12, lz = 950;
          for (let i = 0; i < 210; i++) {
            g.tick(1 / 60, false);
            const b = kp.body.position;
            if (Math.hypot(b.x - lx, b.y - ly, b.z - lz) > 3) keepRescues++;
            lx = b.x; ly = b.y; lz = b.z;
          }
          keepHover = +(kp.body.position.y - restY).toFixed(2);
        }
      }
      let stuckHidden = 0, hiddenNow = 0;
      const tNow = g.state.time;
      for (const pr of g.props) {
        if (!pr.hidden) continue;
        hiddenNow++;
        if (pr.hiddenUntil !== undefined && pr.hiddenUntil < tNow) stuckHidden++;
      }
      const room = (g.hud && g.hud.roomAudit) ? g.hud.roomAudit() : null;
      // A position written from outside, smaller than capyPIN_MAX, on an idle
      // animal. Anything but a couple of centimetres back is the pin firing.
      let pinKick = 0, pinNet = 0;
      {
        const cbp = g.capy.body;
        cbp.velocity.set(0, 0, 0);
        for (let i = 0; i < 180; i++) g.tick(1 / 60, false);   // arm the pin
        const px = cbp.position.x, pz = cbp.position.z;
        cbp.position.x = px + 0.5;
        cbp.previousPosition.copy(cbp.position);
        cbp.interpolatedPosition.copy(cbp.position);
        g.tick(1 / 60, false);
        pinKick = +Math.hypot(cbp.velocity.x, cbp.velocity.z).toFixed(1);
        for (let i = 0; i < 90; i++) g.tick(1 / 60, false);
        pinNet = +(cbp.position.x - px).toFixed(2);           // 0.50 is "kept"
      }
      const calmNow = (g.hud && g.hud.calmAudit) ? +g.hud.calmAudit().calm.toFixed(2) : 'n/a';
      console.error = oe;
      return {
        biome: g.biome.current, started: g.state.started,
        peakState, groundMax, airMax, fallSpeed,
        keepHover, keepRescues,
        hiddenNow, stuckHidden,
        roomFor: room ? room.biome : 'n/a', roomWet: room ? +room.wet.toFixed(3) : 'n/a',
        roomRight: room ? room.biome === name : 'n/a',
        pinKick, pinNet, calmNow,
        loaf: (loaf === loaf) ? +loaf.toFixed(2) : 'NaN',
        loafSane: loaf === loaf && loaf >= 0 && loaf <= 1,
        chasing: ownN, ownTMax: +ownMax.toFixed(1), localDrift: +ownDrift.toFixed(2),
        gustRoamMax: +roamMax.toFixed(2), gustRoamN: roamN,
        nanFrames, camNaN, belowVoid, stuckFrames,
        minY: +minY.toFixed(2), maxY: +maxY.toFixed(2), maxSpeed: +maxSpeed.toFixed(1),
        // the fuzz's own clamps over the eight seconds, and the teleport's,
        // apart — the second column is the harness measuring itself
        solverSaves: saves1 - saves0,
        solverCandidates: [...solverBodies.values()],
        keepSaves: (g.state.solverSaves || 0) - saves1,
        end: [+g.capy.position.x.toFixed(1), +g.capy.position.y.toFixed(1), +g.capy.position.z.toFixed(1)],
        errs: errs.slice(0, 6), lastError: g.state.lastError || null,
      };
      } finally { console.error = oe; }
    }, [n, sysFUZZ_SEC, sysFUZZ_SPEED_BY[n] || sysFUZZ_SPEED_MAX, fallPhysics, traceFall]);
    console.log('fuzz ' + n + ' ' + JSON.stringify({ started: res[n].started,
      maxSpeed: res[n].maxSpeed, nan: res[n].nanFrames, void: res[n].belowVoid }));
  }
  // ---- THE GATE --------------------------------------------------------
  // Written into the file AND thrown, so a caller reading the JSON and a
  // caller reading run-code's exit status both see it. Every rule here is
  // one the title card passes silently: started, moved, no NaN, no fall, no
  // error, and landed in the chapter it was sent to.
  const fail = [];
  if (started !== true) fail.push('started !== true after live title control (the fuzz ran against the title card)');
  for (const n of names) {
    const r = res[n] || {};
    if (r.started !== true) fail.push(n + ': started ' + r.started);
    if (r.biome !== n) fail.push(n + ': biome read ' + r.biome);
    if (!(r.maxSpeed >= 1)) fail.push(n + ': maxSpeed ' + r.maxSpeed + ' < 1 (no input reached the animal)');
    const speedCap = sysFUZZ_SPEED_BY[n] || sysFUZZ_SPEED_MAX;
    if (r.fallSpeed.unexplainedFrames || r.fallSpeed.unexplainedPolls || r.fallSpeed.maxUnexplainedSpeed > speedCap)
      fail.push(n + ': maxSpeed ' + r.maxSpeed + ', unexplained ' + r.fallSpeed.maxUnexplainedSpeed + ' > ' + speedCap +
        ' (' + r.fallSpeed.unexplainedFrames + ' observed frames, ' + r.fallSpeed.unexplainedPolls + ' polls not certified release falls)');
    if (r.nanFrames) fail.push(n + ': nanFrames ' + r.nanFrames);
    if (r.camNaN) fail.push(n + ': camNaN ' + r.camNaN);
    if (r.belowVoid) fail.push(n + ': belowVoid ' + r.belowVoid);
    // THE SANITISER IS A NET, NOT A FLOOR (L6, E8 / qa F4). `solverSaves` is
    // the delta over the eight seconds of input, with the keepsake teleport's
    // own clamps kept apart in `keepSaves`; a non-zero delta is a body being
    // clamped every frame — Monaco's hidden camera, falling for ever under
    // the world, read +107 here and the column had stopped meaning "clean".
    // ...AND ONE IS NOT EVERY FRAME (L6-4). Eight seconds of random keys kick
    // props, and a crate knocked into a wall can be clamped ONCE; measured
    // across five runs on the finished L6 tree the delta was +1 or +2 in one
    // to three chapters, a different chapter each time, with lastError null.
    // Every frame is 480 in eight seconds; the gate is at five, which a
    // falling body reaches in a twelfth of a second.
    const sysFUZZ_SAVES_MAX = 5;
    if (r.solverSaves > sysFUZZ_SAVES_MAX) fail.push(n + ': solverSaves +' + r.solverSaves + ' (a body is being clamped every frame)');
    if (r.lastError) fail.push(n + ': lastError ' + String(r.lastError).slice(0, 120));
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=fuzz.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, { started, fail, pass: fail.length === 0, res });
  if (fail.length) throw new Error('fuzz FAILED (' + fail.length + '):\n  ' + fail.join('\n  '));
}
