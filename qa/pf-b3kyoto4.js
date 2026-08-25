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
    const R = { issues: [] }
    const settle = n => { for (let i = 0; i < n; i++) g.tick(1 / 60, false) }
    g.biome.switchTo('kyoto')
    const b = g.capy.body, K = g.kyoto
    b.position.set(K.bridge.x, -0.4, K.bridge.z + 4); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    settle(60)

    // snapshot the EXACT payout frame
    const oct = g.completeTask
    let snap = null
    const cues = []
    const of = g.sfx
    g.sfx = function (n, o) { cues.push(n + (o && o.at ? '@POS' : ' MONO')); return of.apply(g, arguments) }
    g.completeTask = function (id) {
      if (id === 'uji-run' && !snap) {
        const cp = g.camera.position, ap = g.capy.position
        const dx = cp.x - ap.x, dz = cp.z - ap.z, dy = cp.y - ap.y
        snap = { capy: [+ap.x.toFixed(1), +ap.y.toFixed(1), +ap.z.toFixed(1)],
          cam: [+cp.x.toFixed(1), +cp.y.toFixed(1), +cp.z.toFixed(1)],
          dist: +Math.hypot(dx, dz).toFixed(1), boom: +Math.hypot(dx, dy, dz).toFixed(1),
          yawDeg: +(Math.atan2(dx, dz) * 180 / Math.PI).toFixed(1),
          pitchDeg: +(Math.atan2(dy, Math.hypot(dx, dz)) * 180 / Math.PI).toFixed(1),
          millBearing: +(Math.atan2(K.mill.x - ap.x, K.mill.z - ap.z) * 180 / Math.PI).toFixed(1),
          millDist: +Math.hypot(K.mill.x - ap.x, K.mill.z - ap.z).toFixed(1),
          cues: cues.slice(-6) }
      }
      return oct.apply(g, arguments)
    }
    // ride, but stop steering once inside the mill pond
    let t = 0
    for (let i = 0; i < 60 * 120 && !snap; i++) {
      const p = g.capy.position
      const dx = K.mill.x - p.x, dz = K.mill.z - p.z, m = Math.hypot(dx, dz) || 1
      if (m > 14) { g.input.x = dx / m; g.input.z = dz / m; g.input.run = true }
      else { g.input.x = 0; g.input.z = 0; g.input.run = false }
      settle(1); t += 1 / 60
    }
    g.input.x = 0; g.input.z = 0; g.input.run = false
    R.rideS = +t.toFixed(1)
    R.payoutFrame = snap
    R.posNow = [+g.capy.position.x.toFixed(1), +g.capy.position.z.toFixed(1)]

    // ---- does the finish RE-FIRE while you sit in the mill pond? ---------
    const before = cues.length
    settle(60 * 30)                       // 30 s of floating in the mill pond
    const after = cues.slice(before)
    R.cuesIn30sFloating = after.length
    R.refires = after.filter(c => c.indexOf('chime') === 0).length
    R.sample = after.slice(0, 12)
    R.runBest = K.runBest ? +K.runBest().toFixed(2) : null
    g.sfx = of; g.completeTask = oct
    R.err = g.state.lastError ? String(g.state.lastError).slice(0, 200) : null
    return R
  })
  out.errs = errs.slice(0, 8)
  await page.evaluate(async o => {
    await fetch('/shot?name=b3k4.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
  await page.waitForTimeout(1500)
}
