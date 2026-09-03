async page => {
  // D5: DOES THE LAND MEET THE WATER, AND DOES THE RAIN LAND?
  //
  // Four questions.
  //
  //   WIRED. How many VISIBLE materials in the live chapter carry the shore
  //   term (`material.userData.grainShore > 0`), and what waterline the shared
  //   uniform is actually drawing at. A material whose option was dropped on
  //   the way through a clone still draws — it is simply the one thing on the
  //   coastline with no waterline on it, which is grainOwn's old bug and is
  //   not something a frame-mean metric can see.
  //
  //   DRAWN. A paired A/B in ONE js turn at a station on the shoreline: render,
  //   read the pixels, park the waterline under the world with
  //   `game.shoreAudit(-9999)`, render, read again. The fraction of the frame
  //   that changed is what the term paints.
  //
  //   AND THE A/A UNDERNEATH IT, which is the half that makes the number mean
  //   anything. Two of these chapters have a moving sea in them and a frame
  //   differs from the frame before it whether or not anything was changed; the
  //   first run of this probe read 2.59 % in Antarctica against a 1.80 % floor
  //   and 0.42 % in MANLY, which has no shore term in it at all. Both renders
  //   after the first are taken with dt = 1e-6 so the sparkle does not move
  //   between them, and the A/A is reported beside the A/B in every row.
  //
  //   THE RAIN LANDS. A forced downpour, then `weather.ringAudit()`: how many
  //   rings are alive against the 6-10/s the rate table asks for, and every
  //   live ring's height above whatever surface the biome says is under it.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.setViewportSize({ width: 1100, height: 660 })
  const out = { errs: [] }

  await page.goto('http://localhost:5188/')
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(7000)

  // ---- 1 and 2. wired, and drawn -----------------------------------------
  //
  // THE STATIONS ARE ON THE WATERLINE AND THEY HAD TO BE. The resting camera
  // at a chapter's spawn does not look at the shore in four of these five, and
  // the first run of this probe measured the effect at the spawn and reported
  // 0.11 % in the Quay and 0.00 % in Antarctica — a term that is drawn, framed
  // out of shot. Each row is a point a few metres LANDWARD of where the
  // chapter's own terrainHeight crosses its own waterLevel, and the camera
  // sits behind the animal on +Z in every chapter in this game, so the water
  // has to be to the animal's -Z for the shot to contain any.
  out.shore = await page.evaluate(async () => {
    const g = window.__capy
    const STATIONS = [
      // name, x, z, and how far above the ground to drop the animal
      { n: 'quay', x: 46, z: 22, up: 1.0 },
      { n: 'palawan', x: 0, z: 34, up: 1.2 },
      { n: 'antarctic', x: 8, z: 40, up: 1.0 },
      { n: 'iceland', x: -20, z: 134, up: 1.0 },
      { n: 'venice', x: 10, z: 20, up: 1.2 },
      // THE TWO CONTROLS. Manly is the reference the roadmap says not to touch
      // and Sydney has no shore term either; both must read zero materials and
      // a signal indistinguishable from their own noise.
      { n: 'manly', x: 0, z: 20, up: 1.2 },
      { n: 'sydney', x: 4, z: 20, up: 1.0 },
    ]
    function apiOf(n) { return n === 'sydney' ? g.env : g[n] }
    function grab() {
      const c = g.renderer.domElement
      const t = document.createElement('canvas')
      t.width = c.width; t.height = c.height
      t.getContext('2d').drawImage(c, 0, 0)
      return t.getContext('2d').getImageData(0, 0, t.width, t.height).data
    }
    function diff(A, B) {
      let n = 0, sum = 0
      for (let i = 0; i < A.length; i += 4) {
        const d = (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) +
                   Math.abs(A[i + 2] - B[i + 2])) / 3
        if (d > 2) { n++; sum += d }
      }
      return { pct: +(100 * n / (A.length / 4)).toFixed(2),
               mean: +(sum / Math.max(n, 1)).toFixed(1) }
    }
    // VISIBLE, and every ancestor visible with it. A chapter's roots stay in
    // the scene when it is not live, so a bare traverse counts every shored
    // material ever built and the number only ever goes up: 31, 54, 59, 85,
    // 108 across five chapters on the first run.
    function shown(o) { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true }
    const rows = []
    for (const s of STATIONS) {
      g.biome.switchTo(s.n)
      const api = apiOf(s.n)
      const h = (api && typeof api.terrainHeight === 'function') ? api.terrainHeight(s.x, s.z) : 0
      g.capy.body.position.set(s.x, h + s.up, s.z)
      g.capy.body.velocity.set(0, 0, 0)
      // TEN SECONDS, NOT THREE. `switchTo` does not arrive at a chapter, it
      // starts arriving: the grade, the airlight and the hemisphere all damp
      // in over about eight seconds, and a probe that settles for three
      // measures the PREVIOUS chapter's atmosphere. The first run of this file
      // read a strong Antarctic signal that decayed to 0.01 % over twelve
      // consecutive samples with the camera and the animal both stationary,
      // which is what that looks like from the outside.
      for (let i = 0; i < 600; i++) g.tick(1 / 60, false)
      g.tick(1 / 60, true); const A = grab()
      g.tick(1e-6, true); const A2 = grab()
      g.shoreAudit(-9999)
      g.tick(1e-6, true); const B = grab()
      g.shoreAudit(null); g.tick(1e-6, true)
      let mats = 0
      g.scene.traverse(function (o) {
        if (!o.isMesh || !o.material || !shown(o)) return
        const ms = Array.isArray(o.material) ? o.material : [o.material]
        for (const m of ms) if (m.userData && m.userData.grainShore > 0) { mats++; break }
      })
      const sig = diff(A, B), noise = diff(A, A2)
      rows.push({ ask: s.n, biome: g.biome.current, mats: mats,
                  y: +g.shoreAudit().y.toFixed(2),
                  sig: sig.pct, sigMean: sig.mean, noise: noise.pct,
                  clear: +g.camInfo.clear.toFixed(2) })
    }
    return rows
  })

  // ---- 3. the pictures ----------------------------------------------------
  await page.evaluate(async () => {
    const g = window.__capy
    async function shoot(name) {
      const d = g.renderer.domElement.toDataURL('image/png')
      await fetch('/shot?name=' + name, { method: 'POST', body: d.split(',')[1] })
    }
    function apiOf(n) { return n === 'sydney' ? g.env : g[n] }
    const S = [
      { n: 'quay', x: 46, z: 22, up: 1.0 },
      { n: 'palawan', x: 0, z: 34, up: 1.2 },
      { n: 'antarctic', x: 8, z: 40, up: 1.0 },
      { n: 'iceland', x: -20, z: 134, up: 1.0 },
      { n: 'venice', x: 10, z: 20, up: 1.2 },
    ]
    for (const s of S) {
      g.biome.switchTo(s.n)
      const api = apiOf(s.n)
      const h = (api && typeof api.terrainHeight === 'function') ? api.terrainHeight(s.x, s.z) : 0
      g.capy.body.position.set(s.x, h + s.up, s.z)
      g.capy.body.velocity.set(0, 0, 0)
      // TEN SECONDS, NOT THREE. `switchTo` does not arrive at a chapter, it
      // starts arriving: the grade, the airlight and the hemisphere all damp
      // in over about eight seconds, and a probe that settles for three
      // measures the PREVIOUS chapter's atmosphere. The first run of this file
      // read a strong Antarctic signal that decayed to 0.01 % over twelve
      // consecutive samples with the camera and the animal both stationary,
      // which is what that looks like from the outside.
      for (let i = 0; i < 600; i++) g.tick(1 / 60, false)
      g.tick(1 / 60, true); await shoot('d5-' + s.n + '-on')
      g.shoreAudit(-9999); g.tick(1e-6, true); await shoot('d5-' + s.n + '-off')
      g.shoreAudit(null); g.tick(1e-6, true)
    }
  })

  // ---- 4. the tide carries the line --------------------------------------
  //
  // Venice is the one chapter whose waterline is a clock, and the whole reason
  // the term reads `waterLevel` off the live biome every frame rather than
  // baking a constant. Sampled across a full acqua alta: the uniform must
  // follow venWaterY from venTIDE_LOW to venTIDE_HIGH and back.
  out.tide = await page.evaluate(async () => {
    const g = window.__capy
    function grab() {
      const c = g.renderer.domElement
      const t = document.createElement('canvas')
      t.width = c.width; t.height = c.height
      t.getContext('2d').drawImage(c, 0, 0)
      return t.getContext('2d').getImageData(0, 0, t.width, t.height).data
    }
    function diff(A, B) {
      let n = 0
      for (let i = 0; i < A.length; i += 4) {
        const d = (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) +
                   Math.abs(A[i + 2] - B[i + 2])) / 3
        if (d > 2) n++
      }
      return +(100 * n / (A.length / 4)).toFixed(2)
    }
    async function shoot(name) {
      const d = g.renderer.domElement.toDataURL('image/png')
      await fetch('/shot?name=' + name, { method: 'POST', body: d.split(',')[1] })
    }
    g.biome.switchTo('venice')
    g.capy.body.position.set(10, g.venice.terrainHeight(10, 20) + 1.2, 20)
    for (let i = 0; i < 600; i++) g.tick(1 / 60, false)
    const seen = []
    let high = null
    for (let k = 0; k < 240; k++) {
      for (let i = 0; i < 30; i++) g.tick(1 / 30, false)
      const y = +g.shoreAudit().y.toFixed(2)
      seen.push(y)
      // THE MARQUEE FRAME: a metre of water over the Piazzetta. Caught the
      // first time the tide is within 5 cm of its top, which is the one moment
      // this chapter's waterline is somewhere the game's other eighteen never
      // put one — halfway up a wall the player was standing at the foot of.
      if (high === null && y > 0.90) {
        for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
        g.tick(1 / 60, true); const A = grab(); await shoot('d5-venice-high-on')
        g.shoreAudit(-9999); g.tick(1e-6, true); const B = grab()
        await shoot('d5-venice-high-off')
        g.shoreAudit(null); g.tick(1e-6, true)
        high = { y: +g.shoreAudit().y.toFixed(2), sig: diff(A, B) }
      }
    }
    return { min: Math.min.apply(null, seen), max: Math.max.apply(null, seen),
             first: seen[0], distinct: new Set(seen).size, high: high }
  })

  // ---- 5. the rain lands --------------------------------------------------
  out.rings = await page.evaluate(async () => {
    const g = window.__capy
    const rows = []
    for (const n of ['sydney', 'kyoto', 'palawan', 'antarctic']) {
      g.biome.switchTo(n)
      for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
      // A DOWNPOUR ON DEMAND. odds 1 and a gap of a fifth of a second, so the
      // roll of the dice cannot miss.
      //
      // hold 60, NOT 400, AND THE FIRST RUN GOT THIS WRONG. `wxEnvelope` takes
      // the fraction of the HOLD that has elapsed, so a 400-second shower
      // sampled at 25 s is 6 % of the way in and still climbing: it reported
      // rainT 0.178 in all three chapters — the attack, measured, and read as
      // a rain system that could not reach its own peak.
      g.weather.set(n, { rain: { odds: 1, peak: 1, hold: 60, gap: 0.2 } })
      for (let i = 0; i < 60 * 22; i++) g.tick(1 / 60, false)
      const a0 = g.weather.ringAudit()
      for (let i = 0; i < 60 * 4; i++) g.tick(1 / 60, false)
      const a = g.weather.ringAudit()
      const over = a.rings.map(r => r.over)
      rows.push({ biome: g.biome.current, rainT: a.rainT, alive: a.alive,
                  count: a.count, opacity: a.opacity,
                  perSec: +((a.born - a0.born) / 4).toFixed(1),
                  overMin: over.length ? +Math.min.apply(null, over).toFixed(3) : null,
                  overMax: over.length ? +Math.max.apply(null, over).toFixed(3) : null })
    }
    return rows
  })

  // ---- 6. what it costs ---------------------------------------------------
  //
  // The shore term adds no draw call and no triangle — it is arithmetic inside
  // a program every one of these materials was already compiling. The rings
  // add exactly ONE draw call, and only while it is raining. Counted INSIDE
  // the scene pass, because renderer.info resets per render and the
  // composite's final quad is the last thing drawn (the harness note in
  // ROADMAP-DELIGHT).
  out.cost = await page.evaluate(async () => {
    const g = window.__capy
    const rows = []
    for (const n of ['palawan', 'antarctic', 'venice']) {
      g.biome.switchTo(n)
      for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
      g.tick(1 / 60, true)
      rows.push({ biome: g.biome.current, progs: g.renderer.info.programs.length,
                  geos: g.renderer.info.memory.geometries })
    }
    return rows
  })

  out.errs = errs
  await page.evaluate((o) => fetch('/shot?name=d5-shore.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
