async page => {
  // T3e, noHanWillow: the willows, lotus and boat round Hoan Kiem.
  //  - the audit: how many trees, clumps, where; the trunk collider in the world
  //  - hide-and-diff: pinned lenses rendered live, flagged, and at rung 1
  //  - the boat moves at a pedal pace and stops for the animal
  //  - rung 1 takes the sway and the shadows off; the flag hides it all and
  //    takes the trunks out of the physics world
  //  - game.hanoi.wowTarget(): null, then drop lanterns 0 and 1 on a run
  // Hand clock (g.tick), prefs pf 1 pins the governor at rung 0.
  // Fresh session after any hanoi.js edit (modules cache across goto).
  const NAME = 'ten-t3e-willow'
  const PORT = 5195
  const out = {}
  page.setDefaultNavigationTimeout(120000)
  if (await page.evaluate(() => !(window.__capy && window.__capy.biome && window.__capy.biome.current === 'hanoi'))) {
    await page.setViewportSize({ width: 1280, height: 760 })
    await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
    await page.goto('http://localhost:' + PORT + '/'); await page.waitForTimeout(6000)
    await page.evaluate(() => { document.querySelector('.capyui-go').click() }); await page.waitForTimeout(6000)
    for (let i = 0; i < 3; i++) {
      if (await page.evaluate(() => window.__capy.biome.current) === 'hanoi') break
      await page.evaluate(() => { const g = window.__capy; g.state.journeyMode = 'free'; g.hud.cross('hanoi') }); await page.waitForTimeout(11000)
    }
  }
  out.biome = await page.evaluate(() => window.__capy.biome.current)
  out.audit = await page.evaluate(() => {
    const g = window.__capy, w = g.hanoi.willow()
    // is the trunk body really in the world?
    return { w: w, bodies: g.world.bodies.length }
  })
  // ---- the flag and the rung, as state -------------------------------------
  out.states = await page.evaluate(() => {
    const g = window.__capy, r = {}
    const tick = n => { for (let i = 0; i < n; i++) g.tick(1 / 60, false) }
    const pin = st => { Object.assign(g.state, st); tick(2); Object.assign(g.state, st); tick(1) }
    pin({ noHanWillow: false, perfRung: 0 }); r.live = Object.assign(g.hanoi.willow(), { pts: undefined }); r.liveBodies = g.world.bodies.length
    pin({ noHanWillow: false, perfRung: 1 }); r.rung1 = Object.assign(g.hanoi.willow(), { pts: undefined })
    pin({ noHanWillow: true, perfRung: 0 }); r.off = Object.assign(g.hanoi.willow(), { pts: undefined }); r.offBodies = g.world.bodies.length
    pin({ noHanWillow: false, perfRung: 0 }); r.back = Object.assign(g.hanoi.willow(), { pts: undefined }); r.backBodies = g.world.bodies.length
    return r
  })
  // ---- the boat ----------------------------------------------------------
  out.boat = await page.evaluate(() => {
    const g = window.__capy, b = g.capy.body, r = {}
    const s = g.hanoi.SPAWN
    b.position.set(s.x, s.y, s.z); b.velocity.set(0, 0, 0)
    const w0 = g.hanoi.willow().boat
    for (let i = 0; i < 600; i++) { g.tick(1 / 60, false); b.velocity.set(0, 0, 0) }
    const w1 = g.hanoi.willow().boat
    r.free = { from: w0, to: w1, metres10s: +Math.hypot(w1.x - w0.x, w1.z - w0.z).toFixed(2) }
    // the animal swims up beside it: the pedals stop
    for (let i = 0; i < 400; i++) {
      const bt = g.hanoi.willow().boat
      b.position.set(bt.x + 3, -0.4, bt.z); b.velocity.set(0, 0, 0)
      g.tick(1 / 60, false)
    }
    const w2 = g.hanoi.willow().boat
    for (let i = 0; i < 120; i++) { b.position.set(w2.x + 3, -0.4, w2.z); b.velocity.set(0, 0, 0); g.tick(1 / 60, false) }
    const w3 = g.hanoi.willow().boat
    r.shy = { v: w3.v, stops: w3.stops, shy: w3.shy, moved2s: +Math.hypot(w3.x - w2.x, w3.z - w2.z).toFixed(3) }
    b.position.set(s.x, s.y, s.z); b.velocity.set(0, 0, 0)
    for (let i = 0; i < 30; i++) g.tick(1 / 60, false)
    return r
  })
  // ---- the pictures: live, flagged, rung 1, from pinned lenses ------------
  const LENS = {
    sw: { cam: [-66, 8.5, -96], look: [-10, 1, -52] },
    ne: { cam: [48, 9, -18], look: [-6, 1, -64] },
    near: null,          // filled from the first tree the audit reports
  }
  const P = out.audit.w.pts
  const near = P[Math.floor(P.length * 0.62)]
  // a tree on the south-west arc: stand 9 m inland of it (away from the lake centre)
  {
    const dx = near[0] - 0, dz = near[1] + 58, dl = Math.hypot(dx, dz)
    LENS.near = { cam: [near[0] + dx / dl * 10, 3.2, near[1] + dz / dl * 10], look: [near[0] - dx / dl * 2, 2.6, near[1] - dz / dl * 2] }
    out.nearTree = near
  }
  const shots = [['sw', 'live', { noHanWillow: false, perfRung: 0 }], ['sw', 'off', { noHanWillow: true, perfRung: 0 }], ['sw', 'rung1', { noHanWillow: false, perfRung: 1 }],
                 ['ne', 'live', { noHanWillow: false, perfRung: 0 }], ['ne', 'off', { noHanWillow: true, perfRung: 0 }],
                 ['near', 'live', { noHanWillow: false, perfRung: 0 }], ['near', 'off', { noHanWillow: true, perfRung: 0 }]]
  out.diff = {}
  for (const [ln, tag, st] of shots) {
    const r = await page.evaluate(async o => {
      const g = window.__capy, THREE = g.THREE, L = o.L
      Object.assign(g.state, o.st)
      for (let i = 0; i < 3; i++) g.tick(1 / 60, false)
      Object.assign(g.state, o.st)
      g.tick(1 / 60, false)
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280 / 760; g.camera.updateProjectionMatrix()
      g.camera.position.set(L.cam[0], L.cam[1], L.cam[2])
      g.camera.lookAt(new THREE.Vector3(L.look[0], L.look[1], L.look[2]))
      g.camera.updateMatrixWorld(true)
      g.renderer.render(g.scene, g.camera)
      const cv = document.createElement('canvas'); cv.width = 320; cv.height = 190
      const cx = cv.getContext('2d'); cx.drawImage(g.renderer.domElement, 0, 0, 320, 190)
      const px = Array.from(cx.getImageData(0, 0, 320, 190).data)
      const d = g.renderer.domElement.toDataURL('image/png')
      await fetch('/shot?name=' + o.name, { method: 'POST', body: d.split(',')[1] })
      window.__t3ePx = window.__t3ePx || {}
      window.__t3ePx[o.key] = px
      let changed = 0
      if (o.base && window.__t3ePx[o.base]) {
        const a = window.__t3ePx[o.base]
        for (let i = 0; i < px.length; i += 4) {
          if (Math.max(Math.abs(px[i] - a[i]), Math.abs(px[i + 1] - a[i + 1]), Math.abs(px[i + 2] - a[i + 2])) > 12) changed++
        }
      }
      return { w: Object.assign(g.hanoi.willow(), { pts: undefined }), changedPct: +(changed / (320 * 190) * 100).toFixed(2) }
    }, { L: LENS[ln], st, name: NAME + '-' + ln + '-' + tag, key: ln + tag, base: tag === 'live' ? null : ln + 'live' })
    out.diff[ln + '-' + tag] = { vis: r.w.vis, sway: r.w.sway, shadow: r.w.shadow, changedPct: r.changedPct }
  }
  await page.evaluate(() => { const g = window.__capy; g.state.noHanWillow = false; g.state.perfRung = 0 })
  // ---- wowTarget -------------------------------------------------------
  out.wow = await page.evaluate(() => {
    const g = window.__capy, r = {}
    r.idle = g.hanoi.wowTarget()
    const st = g.hanoi.cubStall()
    const b = g.capy.body
    b.position.set(st.x + 1, st.y + 1, st.z + 0.5); b.velocity.set(0, 0, 0)
    g.tick(1 / 60, false)
    g.hanoi.cubDebug({ take: true })
    for (let i = 0; i < 5; i++) g.tick(1 / 60, false)
    r.cub = g.hanoi.cub()
    r.first = g.hanoi.wowTarget()
    g.hanoi.cubSet({ next: 1 })
    g.tick(1 / 60, false)
    r.second = g.hanoi.wowTarget()
    r.drop1 = g.hanoi.dropAt(1)
    g.hanoi.cubSet({ run: false })
    g.tick(1 / 60, false)
    r.noRun = g.hanoi.wowTarget()
    return r
  })
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=' + o.name + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out)))) }), { name: NAME, out })
}
