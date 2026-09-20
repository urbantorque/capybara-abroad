async page => {
  // ROADMAP-WOW2 V1.2 — squash and stretch, both halves, at 60 Hz through
  // animAudit: the along-velocity stretch on a running hop (sqZ over the
  // arc), the landing squash sized by the impact (min sqY against the fall),
  // and the stroke's bob in the harbour (sqY's swing while swimming).
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(9000)
  const out = { errs }
  out.hops = await page.evaluate(() => {
    const g = window.__capy
    const key = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, key: code === 'Space' ? ' ' : code.replace('Key', '').toLowerCase(), bubbles: true }))
    g.input.camYaw = 0
    const runs = []
    // a standing hop, then a running hop, then a running hop with the term cut
    for (const [name, run, cut] of [['stand', false, false], ['run', true, false], ['run-cut', true, true]]) {
      g.state.noAlive = cut
      for (let k = 0; k < 90; k++) g.tick(1 / 60, false)
      if (run) { key('keydown', 'KeyW'); key('keydown', 'ShiftLeft'); for (let k = 0; k < 75; k++) g.tick(1 / 60, false) }
      const rows = []
      key('keydown', 'Space')
      for (let k = 0; k < 8; k++) g.tick(1 / 60, false)
      key('keyup', 'Space')
      let maxZ = 1, maxY = 1, minY = 1, minYAfter = 1, fall = 0, landedAt = -1, tMaxZ = -1, groundedWas = true
      for (let k = 0; k < 110; k++) {
        g.tick(1 / 60, false)
        const a = g.capy.animAudit()
        const gr = g.capy.grounded
        if (k < 40) { if (a.sqZ > maxZ) { maxZ = a.sqZ; tMaxZ = k } if (a.sqY > maxY) maxY = a.sqY }
        if (!gr) groundedWas = false
        if (!groundedWas && gr && landedAt < 0) landedAt = k
        if (landedAt >= 0 && a.sqY < minYAfter) minYAfter = a.sqY
        const vy = g.capy.body ? g.capy.body.velocity.y : 0
        if (vy < fall) fall = vy
        if (k % 3 === 0 && k < 60) rows.push([k, +a.sqY.toFixed(3), +a.sqZ.toFixed(3), +a.sqX.toFixed(3), +a.stretch.toFixed(2), gr ? 1 : 0, +vy.toFixed(2)])
      }
      if (run) { key('keyup', 'KeyW'); key('keyup', 'ShiftLeft') }
      runs.push({ name, maxSqZ: +maxZ.toFixed(4), atFrame: tMaxZ, maxSqY: +maxY.toFixed(4), minSqYAfterLand: +minYAfter.toFixed(4), landedAt, fallV: +(-fall).toFixed(2), rows })
      for (let k = 0; k < 120; k++) g.tick(1 / 60, false)
    }
    g.state.noAlive = false
    return runs
  })
  // a drop off the Opera House podium is not reachable blind; the landing law
  // is read off the standing hop's fall (5 m/s) and a taller arc: a held Space
  out.tallHop = await page.evaluate(() => {
    const g = window.__capy
    const key = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, key: ' ', bubbles: true }))
    for (let k = 0; k < 60; k++) g.tick(1 / 60, false)
    key('keydown', 'Space')
    for (let k = 0; k < 30; k++) g.tick(1 / 60, false)
    key('keyup', 'Space')
    let fall = 0, minY = 1, landedAt = -1, was = true
    for (let k = 0; k < 150; k++) {
      g.tick(1 / 60, false)
      const a = g.capy.animAudit(), gr = g.capy.grounded
      const vy = g.capy.body ? g.capy.body.velocity.y : 0
      if (vy < fall) fall = vy
      if (!gr) was = false
      if (!was && gr && landedAt < 0) landedAt = k
      if (landedAt >= 0 && a.sqY < minY) minY = a.sqY
    }
    return { fallV: +(-fall).toFixed(2), minSqYAfterLand: +minY.toFixed(4), landedAt }
  })
  // the harbour: Sydney's water is z < -10 off the podium's flanks. Steered
  // in closed loop on input.x/z the way qa/b8-hkroof3.js does (a keydown
  // walks along the LIVE camera, which the harness does not hold still).
  out.swim = await page.evaluate(() => {
    const g = window.__capy, inp = g.input
    const steer = (tx, tz) => {
      const p = g.capy.position, dx = tx - p.x, dz = tz - p.z, m = Math.hypot(dx, dz) || 1
      const cy = inp.camYaw || 0
      inp.x = Math.cos(cy) * (dx / m) - Math.sin(cy) * (dz / m)
      inp.z = Math.sin(cy) * (dx / m) + Math.cos(cy) * (dz / m)
      inp.run = true
      return m
    }
    let swimAt = -1, rows = [], lo = 9, hi = -9, k = 0
    for (; k < 60 * 45; k++) {
      const p = g.capy.position
      steer(26, p.z > 0 ? 0 : -40)
      if (p.x > 22 && p.z > -2) steer(26, -40)
      g.tick(1 / 60, false)
      const a = g.capy.animAudit()
      if (a.swimBobW > 0.9) {
        if (swimAt < 0) swimAt = k
        if (a.sqY < lo) lo = a.sqY
        if (a.sqY > hi) hi = a.sqY
        if (rows.length < 40 && k % 2 === 0) rows.push(+a.sqY.toFixed(3))
        if (k - swimAt > 180) break
      }
    }
    inp.x = 0; inp.z = 0; inp.run = false
    const p = g.capy.position
    return { swimAt, swing: swimAt >= 0 ? +(hi - lo).toFixed(4) : null, lo: +lo.toFixed(3), hi: +hi.toFixed(3), rows, pos: [+p.x.toFixed(1), +p.y.toFixed(2), +p.z.toFixed(1)], ticks: k }
  })
  // ...and a picture of the running hop 100 ms after the fire, live and cut,
  // side on through an own lens, so the stretch can be read by eye
  for (const cut of [false, true]) {
    const url = await page.evaluate((cut) => {
      const g = window.__capy, T = g.THREE, inp = g.input
      g.state.noAlive = cut
      for (let k = 0; k < 60; k++) { inp.x = 0; inp.z = 0; g.tick(1 / 60, false) }
      inp.camYaw = 0
      for (let k = 0; k < 75; k++) { inp.x = 0; inp.z = -1; inp.run = true; g.tick(1 / 60, false) }
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }))
      for (let k = 0; k < 8; k++) { inp.x = 0; inp.z = -1; g.tick(1 / 60, false) }
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true }))
      let air = 0
      for (let k = 0; k < 40 && air < 6; k++) { inp.x = 0; inp.z = -1; g.tick(1 / 60, false); if (!g.capy.grounded) air++ }
      const a = g.capy.animAudit()
      const p = g.capy.position
      const c = new T.PerspectiveCamera(30, 1280 / 760, 0.05, 400)
      c.position.set(p.x + 3.2, p.y + 0.3, p.z); c.lookAt(p.x, p.y, p.z); c.updateMatrixWorld()
      g.renderer.setRenderTarget(null); g.renderer.render(g.scene, c)
      inp.z = 0; inp.run = false; g.state.noAlive = false
      window.__sq = { sqY: +a.sqY.toFixed(3), sqZ: +a.sqZ.toFixed(3), stretch: +a.stretch.toFixed(2) }
      return g.renderer.domElement.toDataURL('image/png')
    }, cut)
    out['shot-' + (cut ? 'cut' : 'live')] = await page.evaluate(() => window.__sq)
    await page.evaluate(async (o) => { await fetch('/shot?name=' + o.n, { method: 'POST', body: o.u }) }, { n: 'wow2-squash-' + (cut ? 'cut' : 'live'), u: url })
    await page.evaluate(() => { const g = window.__capy; for (let k = 0; k < 120; k++) g.tick(1 / 60, false) })
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=wow2-squash.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
