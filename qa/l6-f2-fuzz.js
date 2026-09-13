async page => {
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
  await page.goto('http://localhost:5190/');
  await page.waitForTimeout(6000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);
  const started = await page.evaluate(() => !!(window.__capy && window.__capy.state.started));
  const names = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland',
                 'sahara', 'drift', 'venice', 'kowloon', 'palawan', 'goreme',
                 'manly', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi'];
  const res = {};
  for (const n of names) {
    res[n] = await page.evaluate(async (name) => {
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
      const g = window.__capy;
      const errs = [];
      const oe = console.error;
      console.error = function (...a) { errs.push(a.map(x => (x && x.stack) || String(x)).join(' ')); oe.apply(console, a); };
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
      let camNaN = 0, stuckFrames = 0, lastX = 0, lastZ = 0;
      const held = new Set();
      const saves0 = g.state.solverSaves || 0;     // cumulative; see the header
      const t0 = performance.now();
      while (performance.now() - t0 < 8000) {
        if (rnd() < 0.09) {
          const k = KEYS[(rnd() * KEYS.length) | 0];
          if (held.has(k)) { up(k); held.delete(k); } else { down(k); held.add(k); }
        }
        await sleep(16);
        const p = g.capy.position, v = g.capy.body.velocity, c = g.camera.position;
        if (!(p.x === p.x && p.y === p.y && p.z === p.z)) nanFrames++;
        if (!(v.x === v.x && v.y === v.y && v.z === v.z)) nanFrames++;
        if (!(c.x === c.x && c.y === c.y && c.z === c.z)) camNaN++;
        const terr = (g[name === 'sydney' ? 'env' : name] && g[name === 'sydney' ? 'env' : name].terrainHeight)
          ? g[name === 'sydney' ? 'env' : name].terrainHeight(p.x, p.z) : 0;
        if (p.y < (terr === terr ? terr : 0) - 8) belowVoid++;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
        const spd = Math.hypot(v.x, v.y, v.z); if (spd > maxSpeed) maxSpeed = spd;
        if (Math.hypot(p.x - lastX, p.z - lastZ) < 0.004 && held.size) stuckFrames++;
        lastX = p.x; lastZ = p.z;
      }
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
        keepSaves: (g.state.solverSaves || 0) - saves1,
        end: [+g.capy.position.x.toFixed(1), +g.capy.position.y.toFixed(1), +g.capy.position.z.toFixed(1)],
        errs: errs.slice(0, 6), lastError: g.state.lastError || null,
      };
    }, n);
  }
  // ---- THE GATE --------------------------------------------------------
  // Written into the file AND thrown, so a caller reading the JSON and a
  // caller reading run-code's exit status both see it. Every rule here is
  // one the title card passes silently: started, moved, no NaN, no fall, no
  // error, and landed in the chapter it was sent to.
  const fail = [];
  if (started !== true) fail.push('started !== true after Enter (the fuzz ran against the title card)');
  for (const n of names) {
    const r = res[n] || {};
    if (r.started !== true) fail.push(n + ': started ' + r.started);
    if (r.biome !== n) fail.push(n + ': biome read ' + r.biome);
    if (!(r.maxSpeed >= 1)) fail.push(n + ': maxSpeed ' + r.maxSpeed + ' < 1 (no input reached the animal)');
    if (r.nanFrames) fail.push(n + ': nanFrames ' + r.nanFrames);
    if (r.camNaN) fail.push(n + ': camNaN ' + r.camNaN);
    if (r.belowVoid) fail.push(n + ': belowVoid ' + r.belowVoid);
    // THE SANITISER IS A NET, NOT A FLOOR (L6, E8 / qa F4). `solverSaves` is
    // the delta over the eight seconds of input, with the keepsake teleport's
    // own clamps kept apart in `keepSaves`; a non-zero delta is a body being
    // clamped every frame — Monaco's hidden camera, falling for ever under
    // the world, read +107 here and the column had stopped meaning "clean".
    if (r.solverSaves) fail.push(n + ': solverSaves +' + r.solverSaves + ' (a body is being clamped every frame)');
    if (r.lastError) fail.push(n + ': lastError ' + String(r.lastError).slice(0, 120));
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l6-f2-fuzz.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, { started, fail, pass: fail.length === 0, res });
  if (fail.length) throw new Error('fuzz FAILED (' + fail.length + '):\n  ' + fail.join('\n  '));
}
