async page => {
  // ---- P2, MEASURED: WHERE IS THE HORIZON? (batch 5, job 2c) --------------
  // Real keys, real clock, all nineteen chapters. The number that matters is
  //   pitch − halfFOV
  // — the angle of the horizon ABOVE the top edge of the frame. Positive means
  // the sky is not on the screen at all.
  //
  // `pitch` is the camera's ACTUAL view direction (getWorldDirection), not the
  // boom angle: the two differ by several degrees because the look target leads
  // the animal, and the boom angle is the one number that does NOT move with
  // speed. Reading the boom angle instead would have said the rig never
  // flattens, which is false and would have hidden the good half of the rig.
  //
  // ---- AND THE STATES ARE CLASSED BY MEASURED SPEED --------------------
  // Not by which keys are held. The first cut held W and then Shift and called
  // the result "walking" and "running": in ELEVEN of the nineteen chapters the
  // animal was against a wall, a stair or a lagoon within a second and the run
  // band was empty — kyoto, cali and manly never got past 1.0 m/s. So the probe
  // tries all four directions and stops as soon as it has enough frames in
  // each band, and a band with no frames prints as a GAP rather than being
  // quietly averaged into the one next to it.
  const TAG = 'after';
  const RAISE_KEY = 'KeyV';      // the held eye-raise. Does nothing before job 2a.
  const WALK_LO = 3.4, WALK_HI = 4.8, RUN_LO = 6.6;
  const WANT = 40;               // frames per band before the direction sweep stops
  const DIRS = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];

  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(6000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(3000);

  const names = await page.evaluate(async () => {
    const src = await (await fetch('/src/shared.js', { cache: 'no-store' })).text();
    const i = src.indexOf('export const CHAPTERS = [');
    if (i < 0) throw new Error('b5-cam: CHAPTERS not found — this audit has gone stale');
    const keys = [];
    for (const m of src.slice(i, src.indexOf('\n];', i)).matchAll(/\bbiome:\s*'([a-z]+)'/g)) keys.push(m[1]);
    return keys;
  });

  // One rAF-driven sample window, well under the ~20 s an evaluate survives.
  const sample = async (frames) => page.evaluate((n) => new Promise(res => {
    const g = window.__capy, T = g.THREE, v = new T.Vector3();
    const rows = [];
    let i = 0;
    const step = () => {
      g.camera.getWorldDirection(v);
      const vy = Math.max(-1, Math.min(1, -v.y));
      const b = g.capy && g.capy.body;
      const sp = b ? Math.hypot(b.velocity.x, b.velocity.z) : 0;
      const ci = g.camInfo || {};
      rows.push({ p: Math.asin(vy) * 180 / Math.PI, h: g.camera.fov / 2, sp: sp,
                  cl: ci.clear === undefined ? 1 : ci.clear,
                  // ON ITS OWN FEET, AND NOT INSIDE A MARQUEE. A falling animal
                  // and an authored shot are both real camera states and neither
                  // is ORDINARY PLAY, which is what P2 is a claim about: the
                  // first cut of this probe measured Pasto at 55.8° at a "run"
                  // because the sweep had walked it off the paramo, and read
                  // that as the rig being steeper at speed than at a standstill.
                  gr: !!(g.capy && g.capy.grounded), sh: ci.shot || 0,
                  vy: b ? Math.abs(b.velocity.y) : 0,
                  // How far the relief clearance had to lift the eye to keep it
                  // out of the hill behind. This is the number that says whether
                  // a steep frame is the RIG or the GROUND — see the report.
                  lf: (ci.lift || 0) + (ci.lift2 || 0), fl: ci.floor || 0,
                  ey: g.camera.position.y - (g.capy ? g.capy.position.y : 0) });
      if (++i < n) requestAnimationFrame(step); else res(rows);
    };
    requestAnimationFrame(step);
  }), frames);

  const med = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
  const out = {};
  for (const name of names) {
    await page.evaluate((n) => {
      const g = window.__capy;
      g.biome.switchTo(n);
      const sp = g.biome.spawnOf(n), b = g.capy.body;
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    }, name);
    await page.waitForTimeout(2500);              // the rig springs to the new place

    const rows = [], raiseRows = [];
    rows.push(...await sample(70));               // idle, nothing held

    // ...and idle again with the eye-raise held. Before job 2a this key is not
    // bound and the two windows are the same picture, which is the finding.
    await page.keyboard.down(RAISE_KEY);
    await page.waitForTimeout(1800);
    raiseRows.push(...await sample(70));
    await page.keyboard.up(RAISE_KEY);
    await page.waitForTimeout(1200);

    // ON ITS OWN FEET, ON THE LEVEL, AND NOT INSIDE A MARQUEE.
    // The vertical-velocity gate is the third filter and it was worth as much
    // as the other two: `sysAnchor.y` is damped, so a capybara running DOWN a
    // paramo hillside leaves the rig behind and the view pitch reads 54° at a
    // full run — steeper than a standstill, which is nonsense as a statement
    // about the rig and true as a statement about that half second.
    const ok = x => x.gr && x.sh < 0.01 && x.vy < 0.5;
    const count = (lo, hi) => rows.filter(x => ok(x) && x.sp >= lo && (hi === undefined || x.sp <= hi)).length;
    // ---- SHORT LEGS, FROM THE SPAWN, EVERY TIME --------------------------
    // The first cut held a key for three seconds before sampling, which is
    // twenty metres of travel: by the time it looked, the animal was up a
    // hill, in a lagoon or against a shopfront somewhere, and three identical
    // runs of this probe reported the run band as 11, 16 and 13 of nineteen.
    // The rig had not changed between them — the WORLD the animal had reached
    // had. Reset to the spawn, hold, and look at 1.1 s: the animal is at full
    // speed and has covered about eight metres, so what is measured is the rig
    // and not where the sweep ended up.
    const goSpawn = () => page.evaluate((n) => {
      const g = window.__capy;
      const sp = g.biome.spawnOf(n), b = g.capy.body;
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    }, name);
    for (const dir of DIRS) {
      if (count(WALK_LO, WALK_HI) >= WANT && count(RUN_LO) >= WANT) break;
      for (const running of [false, true]) {
        await goSpawn();
        await page.waitForTimeout(700);
        await page.keyboard.down(dir);
        if (running) await page.keyboard.down('ShiftLeft');
        // 2.0 s, not 1.1: `camDolly` is damped at lambda 2.4, so at 1.1 s it is
        // only two thirds of the way to a full run and the rig has not finished
        // flattening — cali, rio and sahara read +5 on one pass and -5 on the
        // next for that reason alone. Two seconds is 99% of the dolly and still
        // only about fourteen metres of travel.
        await page.waitForTimeout(2000);
        rows.push(...await sample(45));
        if (running) await page.keyboard.up('ShiftLeft');
        await page.keyboard.up(dir);
        await page.waitForTimeout(400);
      }
    }

    const band = (src, f) => {
      const r = src.filter(f);
      if (!r.length) return { n: 0 };
      const p = med(r.map(x => x.p)), h = med(r.map(x => x.h));
      return { n: r.length, pitch: +p.toFixed(1), half: +h.toFixed(1),
               horizon: +(p - h).toFixed(1), inFrame: (p - h) <= 0,
               eyeUp: +med(r.map(x => x.ey)).toFixed(2),
               lift: +med(r.map(x => x.lf)).toFixed(2),
               floor: +med(r.map(x => x.fl)).toFixed(2) };
    };
    const all = rows.concat(raiseRows);
    // ...AND A CHAPTER MAY NOT BE ABLE TO RUN AT ALL.
    // capyGRADE_MIN takes a third off the top speed on a slope, so on the
    // paramo and in the cave nothing the sweep does reaches 6.6 m/s on level
    // ground. `sprint` is the same measurement against that chapter's OWN
    // fastest level going, so a chapter with hills in it reports a number
    // rather than a hole. Both are printed; neither is allowed to stand in for
    // the other.
    const lvl = rows.filter(ok);
    const own = lvl.length ? Math.max(...lvl.map(x => x.sp)) : 0;
    out[name] = {
      idle: band(rows, x => ok(x) && x.sp < 0.25),
      walk: band(rows, x => ok(x) && x.sp >= WALK_LO && x.sp <= WALK_HI),
      run:  band(rows, x => ok(x) && x.sp >= RUN_LO),
      sprint: band(rows, x => ok(x) && x.sp >= own * 0.9 && x.sp > 3.0),
      // ...AND THE SAME RUN, WITH THE BOOM UNCUT.
      // A sprint down a Mong Kok alley is a real state and the horizon is not
      // in it, and that is the occlusion ray doing exactly its job — the shot
      // is short because there is a wall. The rig cannot be judged on those
      // frames and neither can it be excused by leaving them out, so both
      // numbers are printed. `runOpen` is the rig; `run` is the chapter.
      runOpen: band(rows, x => ok(x) && x.sp >= RUN_LO && x.cl > 0.999),
      sprintSp: +own.toFixed(2),
      raise: band(raiseRows, x => ok(x) && x.sp < 0.25),
      maxSp: +Math.max(...rows.map(x => x.sp)).toFixed(2),
      // THE TRAP IN THIS JOB, COUNTED. Raising the eye lowers it relative to the
      // animal and the occlusion ray starts cutting the boom. camInfo.clear is
      // the fraction of the boom that survived; below 0.999 it was cut.
      // Split, because the two halves answer different questions: `cutFrac` is
      // ordinary play — the number that must not get materially worse — and
      // `cutRaise` is the cost of the new verb, which is allowed to be higher
      // because holding a key to look at the sky in an alley is a thing the
      // player asked for and can stop doing.
      cutFrames: rows.filter(x => x.cl < 0.999).length,
      cutFrac: +(rows.filter(x => x.cl < 0.999).length / rows.length).toFixed(3),
      cutRaise: +(raiseRows.filter(x => x.cl < 0.999).length / raiseRows.length).toFixed(3),
      cutWorst: +Math.min(...all.map(x => x.cl)).toFixed(3),
      frames: all.length,
    };
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b5-cam-' + o.tag + '.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o.d, null, 1)))) });
  }, { tag: TAG, d: out });
}
