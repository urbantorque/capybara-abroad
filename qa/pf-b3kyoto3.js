async page => {
  const errs = []
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 160)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(7000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)

  const out = await page.evaluate(async () => {
    const g = window.__capy
    const R = { issues: [], log: [] }
    const settle = n => { for (let i = 0; i < n; i++) g.tick(1 / 60, false) }
    g.biome.switchTo('kyoto')
    const b = g.capy.body, K = g.kyoto
    // drop in just downstream of the bridge, in the water
    const put = (x, y, z) => { b.position.set(x, y, z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) }
    put(K.bridge.x, -0.4, K.bridge.z + 4)
    settle(60)
    R.riverLength = K.runLength ? +K.runLength().toFixed(1) : (K.riverLength ? +K.riverLength().toFixed(1) : null)
    R.inRiverAtStart = K.inRiver ? K.inRiver() : null

    // instrument the four channels
    let punches = 0, slowmos = 0, hitstops = 0
    const cues = []
    const op = g.punch, os = g.slowmo, oh = g.hitstop, of = g.sfx
    g.punch = function (a) { punches++; cues.push('punch ' + a); return op && op.apply(g, arguments) }
    g.slowmo = function () { slowmos++; cues.push('slowmo'); return os && os.apply(g, arguments) }
    g.hitstop = function () { hitstops++; cues.push('hitstop'); return oh && oh.apply(g, arguments) }
    g.sfx = function (n, o) { cues.push('sfx ' + n + (o && o.at ? ' @POS' : ' MONO')); return of && of.apply(g, arguments) }

    // ride it: swim downstream, let the frame carry
    let done = false, t = 0, best = null
    const startCues = cues.length
    for (let i = 0; i < 60 * 90 && !done; i++) {
      const p = g.capy.position
      // steer toward the mill along +z / +x
      const dx = K.mill.x - p.x, dz = K.mill.z - p.z
      const m = Math.hypot(dx, dz) || 1
      g.input.x = dx / m; g.input.z = dz / m; g.input.run = true
      settle(1); t += 1 / 60
      if (g.tasks && g.tasks.done && g.tasks.done('uji-run')) done = true
      else if (g.hud && g.hud.taskDone && g.hud.taskDone('uji-run')) done = true
      if (!done && Math.hypot(p.x - K.mill.x, p.z - K.mill.z) < 13) {
        // arrived; give it a few frames to fire
        settle(10)
        done = true
      }
    }
    g.input.x = 0; g.input.z = 0; g.input.run = false
    R.rideS = +t.toFixed(1)
    R.finished = done
    R.runBest = K.runBest ? K.runBest() : null
    R.cuesAtPayout = cues.slice(startCues).slice(-24)
    R.punches = punches; R.slowmos = slowmos; R.hitstops = hitstops
    g.punch = op; g.slowmo = os; g.hitstop = oh; g.sfx = of

    // ---- FRAMING at the payout ------------------------------------------
    const cp = g.camera.position, ap = g.capy.position
    const dx = cp.x - ap.x, dz = cp.z - ap.z, dy = cp.y - ap.y
    R.frame = {
      capy: [+ap.x.toFixed(1), +ap.y.toFixed(1), +ap.z.toFixed(1)],
      cam: [+cp.x.toFixed(1), +cp.y.toFixed(1), +cp.z.toFixed(1)],
      dist: +Math.hypot(dx, dz).toFixed(1),
      boom: +Math.hypot(dx, dy, dz).toFixed(1),
      yawDeg: +(Math.atan2(dx, dz) * 180 / Math.PI).toFixed(1),
      pitchDeg: +(Math.atan2(dy, Math.hypot(dx, dz)) * 180 / Math.PI).toFixed(1)
    }
    // where the interesting things are, from the finish
    const bear = (o) => ({ d: +Math.hypot(o.x - ap.x, o.z - ap.z).toFixed(1),
      yaw: +(Math.atan2(o.x - ap.x, o.z - ap.z) * 180 / Math.PI).toFixed(1) })
    R.bearings = { mill: bear(K.mill), bowl: bear(K.bowl), uji: bear(K.uji), bridge: bear(K.bridge) }
    R.gradeHasKyotoRow = 'see source'
    R.err = g.state.lastError ? String(g.state.lastError).slice(0, 200) : null

    // ---- PILLAR 5: dead cells on the route -------------------------------
    // sample 20 m cells along spawn -> zen -> pond -> stones -> gion -> torii -> uji
    const route = [[-16, 52], [-34, 8], [26, -22], [17, -20], [-16, 52], [-6, -46], [-30, -100],
      [-84, -44], [4, 128], [24, 176], [54, 148], [24, 196]]
    const live = g.biome.current
    const L = g.locals.filter(r => r.biome === live)
    const cells = []
    for (let i = 0; i < route.length - 1; i++) {
      const [ax, az] = route[i], [bx2, bz2] = route[i + 1]
      const len = Math.hypot(bx2 - ax, bz2 - az)
      const n = Math.max(1, Math.round(len / 20))
      for (let k = 0; k < n; k++) {
        const f = (k + 0.5) / n
        const x = ax + (bx2 - ax) * f, z = az + (bz2 - az) * f
        let near = 1e9
        for (const r of L) near = Math.min(near, Math.hypot(r.x - x, r.z - z))
        let np = 1e9
        for (const p of g.props) if (!p.removed && (!p.biome || p.biome === live))
          np = Math.min(np, Math.hypot(p.body.position.x - x, p.body.position.z - z))
        cells.push({ x: +x.toFixed(0), z: +z.toFixed(0), local: +near.toFixed(0), prop: +np.toFixed(0),
          zone: ['torii', 'zen', 'gion', 'bamboo', 'uji'].filter(t => K.inZone(t, x, z)).join('+') || '-' })
      }
    }
    R.deadCells = cells.filter(c => c.local > 20 && c.prop > 20 && c.zone === '-')
    R.nCells = cells.length
    return R
  })
  out.errs = errs.slice(0, 8)
  await page.evaluate(async o => {
    await fetch('/shot?name=b3k3.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
