async page => {
  const names = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland',
                 'sahara', 'drift', 'venice', 'kowloon', 'palawan', 'goreme',
                 'manly', 'pantanal', 'cave', 'antarctic'];
  const res = {};
  for (const n of names) {
    res[n] = await page.evaluate((name) => {
      const g = window.__capy;
      const errs = [];
      const oe = console.error;
      console.error = function (...a) { errs.push(a.map(x => (x && x.stack) || String(x)).join(' ')); oe.apply(console, a); };
      const P = g.physics;
      let kp = P.keepOut('sydney');
      if (!kp) kp = P.spawnKeep('sydney', 0, 0);
      if (!kp) { console.error = oe; return { err: 'no keepsake' }; }
      if (g.biome.current !== name) g.biome.switchTo(name);
      const sp = g.biome.spawnOf(name);
      const cb = g.capy.body;
      cb.position.set(sp.x, sp.y, sp.z); cb.velocity.set(0, 0, 0);
      cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position);
      const mod = g[name === 'sydney' ? 'env' : name];
      const TH = (mod && typeof mod.terrainHeight === 'function')
        ? (x, z) => mod.terrainHeight(x, z) : () => NaN;
      // SNAPSHOT the crossing's home before anything else can move it.
      const hx = kp.homeX, hy = kp.homeY, hz = kp.homeZ;
      const th = TH(hx, hz);
      const out = {
        home: [+hx.toFixed(2), +hy.toFixed(2), +hz.toFixed(2)],
        spawn: [+sp.x.toFixed(2), +sp.y.toFixed(2), +sp.z.toFixed(2)],
        terrUnderHome: (th === th) ? +th.toFixed(2) : 'n/a',
        homeAboveTerr: (th === th) ? +(hy - th).toFixed(2) : 'n/a',
        fanFromSpawn: +Math.hypot(hx - sp.x, hz - sp.z).toFixed(2),
      };
      // ---- FORCE A RESCUE: outside physESCAPE_R2 (900 m) ------------------
      function fling() {
        kp.body.wakeUp();
        kp.body.position.set(950, 12, 950);
        kp.body.velocity.set(0, 0, 0);
        kp.body.angularVelocity.set(0, 0, 0);
        kp.body.previousPosition.copy(kp.body.position);
        kp.body.interpolatedPosition.copy(kp.body.position);
      }
      function run(frames) {
        let jumps = 0, below = 0, minY = 1e9;
        let lx = kp.body.position.x, ly = kp.body.position.y, lz = kp.body.position.z;
        const trail = [];
        for (let i = 0; i < frames; i++) {
          g.tick(1 / 60, false);
          const b = kp.body.position;
          if (Math.hypot(b.x - lx, b.y - ly, b.z - lz) > 3) jumps++;
          lx = b.x; ly = b.y; lz = b.z;
          if (b.y < minY) minY = b.y;
          const t2 = TH(b.x, b.z);
          if (t2 === t2 && b.y < t2 - 0.3) below++;
          if (i % 60 === 0) trail.push([+b.x.toFixed(1), +b.y.toFixed(2), +b.z.toFixed(1)]);
        }
        const b = kp.body.position, t2 = TH(b.x, b.z);
        return {
          jumps, framesUnderTerr: below, minY: +minY.toFixed(2), trail,
          end: [+b.x.toFixed(1), +b.y.toFixed(2), +b.z.toFixed(1)],
          endAboveTerr: (t2 === t2) ? +(b.y - t2).toFixed(2) : 'n/a',
        };
      }
      fling();
      out.crossRescue = run(300);           // 5 s
      out.crossRescueErr = +Math.hypot(kp.body.position.x - hx, kp.body.position.z - hz).toFixed(2);
      // ---- relocation #2: stageKeep --------------------------------------
      const tx = sp.x + 5, tz = sp.z + 5;
      P.stageKeep('sydney', tx, tz);
      out.stagedAsk = [+tx.toFixed(2), +tz.toFixed(2)];
      out.stagedHome = [+kp.homeX.toFixed(2), +kp.homeY.toFixed(2), +kp.homeZ.toFixed(2)];
      const sx = kp.homeX, sz = kp.homeZ;
      fling();
      out.stagedRescue = run(180);
      out.stagedRescueErr = +Math.hypot(kp.body.position.x - sx, kp.body.position.z - sz).toFixed(2);
      // ---- relocation #3: the player drops it, THEN it is rescued ---------
      // (home must NOT move for a plain drop — a drop is not a relocation)
      const dropHomeX = kp.homeX, dropHomeZ = kp.homeZ;
      kp.body.wakeUp();
      kp.body.position.set(sp.x + 15, sp.y + 1, sp.z + 15);
      kp.body.previousPosition.copy(kp.body.position);
      kp.body.interpolatedPosition.copy(kp.body.position);
      for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
      out.dropHomeMoved = +Math.hypot(kp.homeX - dropHomeX, kp.homeZ - dropHomeZ).toFixed(2);
      // ---- and in WATER: rescue must clear inWater ------------------------
      out.inWaterAfter = !!kp.inWater;
      out.flags = { hidden: !!kp.hidden, removed: !!kp.removed, held: !!kp.held, biome: kp.biome };
      console.error = oe;
      out.errs = errs.slice(0, 4);
      return out;
    }, n);
  }
  await page.evaluate(async o => {
    await fetch('/shot?name=b4fz-1.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, res);
}
