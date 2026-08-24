async page => {
  // ---- IT STARTS THE GAME NOW ------------------------------------------
  // This assumed it was being run after something else had already booted and
  // pressed past the title card, and if it was not, all seventeen chapters came
  // back IDENTICAL — maxSpeed 0, the same end position to the decimetre, and no
  // errors, which reads as seventeen clean passes and is seventeen runs against
  // a title screen. A suite that cannot fail is worse than no suite.
  await page.goto('http://localhost:5188/index.html');
  await page.waitForTimeout(6000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(3000);
  const names = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland',
                 'sahara', 'drift', 'venice', 'kowloon', 'palawan', 'goreme',
                 'manly', 'pantanal', 'cave', 'antarctic'];
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
      console.error = oe;
      return {
        loaf: (loaf === loaf) ? +loaf.toFixed(2) : 'NaN',
        loafSane: loaf === loaf && loaf >= 0 && loaf <= 1,
        chasing: ownN, ownTMax: +ownMax.toFixed(1), localDrift: +ownDrift.toFixed(2),
        gustRoamMax: +roamMax.toFixed(2), gustRoamN: roamN,
        nanFrames, camNaN, belowVoid, stuckFrames,
        minY: +minY.toFixed(2), maxY: +maxY.toFixed(2), maxSpeed: +maxSpeed.toFixed(1),
        solverSaves: g.state.solverSaves || 0,
        end: [+g.capy.position.x.toFixed(1), +g.capy.position.y.toFixed(1), +g.capy.position.z.toFixed(1)],
        errs: errs.slice(0, 6), lastError: g.state.lastError || null,
      };
    }, n);
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=fuzz.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, res);
}
