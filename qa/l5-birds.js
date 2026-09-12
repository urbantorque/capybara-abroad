async page => {
  // L5 M2 — THE CONDOR AND THE FRIGATEBIRD, on stepped ticks (g.tick) so a
  // flight of two minutes is a second of wall-clock. Pasto: summon, mount,
  // thermal to height, over the crater (the plume), then the tuck from
  // height (the dive: slow-mo, a shot). Rio: summon, mount, the Sugarloaf
  // thermal to 60 m, over the loaf, across to the Corcovado thermal, past
  // the Redentor, then low over the arches — the chain of three and its
  // record. qa/l5-birds.json.
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5000)
  const begin = await page.$('text=Begin')
  if (begin) await begin.click(); else await page.mouse.click(430, 350)
  await page.waitForTimeout(6000)
  const out = { started: await page.evaluate(() => !!window.__capy.state.started) }
  await page.evaluate(() => {
    const g = window.__capy
    const Q = window.__L5B = { toasts: [], slow: 0, shots: 0 }
    const key = (c, t) => window.dispatchEvent(new KeyboardEvent(t || 'keydown', { code: c, key: c, bubbles: true, cancelable: true }))
    Q.tick = n => { for (let i = 0; i < (n || 1); i++) { g.tick(1 / 60, false); if ((g.state.timeScale || 1) < 0.95) Q.slow++; if (g.camInfo.shot > 0.5) Q.shots++ } }
    Q.tap = c => { key(c, 'keydown'); g.tick(1 / 60, false); key(c, 'keyup') }
    const t0 = g.toast; g.toast = function (s) { Q.toasts.push(String(s).slice(0, 70)); return t0.apply(this, arguments) }
    Q.tp = (x, y, z) => { const b = g.capy.body; b.position.set(x, y, z); b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position); Q.tick(10) }
    Q.lift = dy => { const b = g.condor.body; b.position.y += dy; b.previousPosition.y += dy; b.interpolatedPosition.y += dy; const c = g.capy.body; c.position.y += dy; c.previousPosition.y += dy; c.interpolatedPosition.y += dy; Q.tick(5) }
    Q.summon = () => { g.condor.summon(); let t = 0; while (g.condor.state !== 'circling' && t < 900) { g.tick(1 / 60, false); t++ } return { state: g.condor.state, t } }
    Q.mount = () => { g.condor.summon(); Q.tick(200); let m = 0; while (g.condor.state !== 'carrying' && m < 900) { key('KeyE', 'keydown'); g.tick(1 / 60, false); key('KeyE', 'keyup'); g.input.actionPressed = true; m++ } g.input.actionPressed = false; g.input.action = false; return { state: g.condor.state, m } }
    // fly: circle thermal `th` until y >= to, then straight to (x, z); stop when inside r of it at y >= yMin or frames out
    Q.fly = (th, to, x, z, r, yMin, max, tuck) => {
      let maxY = -99, top = 0, minVy = 99
      for (let i = 0; i < max; i++) {
        const p = g.condor.body.position, vv = g.condor.body.velocity
        const sp = Math.hypot(vv.x, vv.y, vv.z); if (sp > top) top = sp; if (vv.y < minVy) minVy = vv.y
        if (g.condor.state !== 'carrying') return { lost: true, i, y: +p.y.toFixed(1) }
        let ux, uz
        if (th && p.y < to) {
          const dx = th.x - p.x, dz = th.z - p.z, d = Math.hypot(dx, dz)
          if (d < th.radius * 0.7) { const a = Math.atan2(p.z - th.z, p.x - th.x); const kx = -Math.sin(a) - 0.45 * Math.cos(a), kz = Math.cos(a) - 0.45 * Math.sin(a); const m = Math.hypot(kx, kz); ux = kx / m; uz = kz / m }
          else { ux = dx / d; uz = dz / d }
        } else {
          const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz)
          if (d < r && p.y >= yMin) return { arrived: true, i, y: +p.y.toFixed(1), maxY: +maxY.toFixed(1), top: +top.toFixed(1), minVy: +minVy.toFixed(1) }
          ux = dx / d; uz = dz / d
        }
        g.tick(1 / 60, false)
        if ((g.state.timeScale || 1) < 0.95) Q.slow++
        if (g.camInfo.shot > 0.5) Q.shots++
        g.input.camYaw = 0; g.input.x = ux; g.input.z = uz; g.input.run = !!tuck
        g.input.actionPressed = false; g.input.whistlePressed = false; g.input.action = false; g.input.whistle = false
        if (p.y > maxY) maxY = p.y
      }
      const p = g.condor.body.position
      return { arrived: false, y: +p.y.toFixed(1), maxY: +maxY.toFixed(1), at: [+p.x.toFixed(0), +p.z.toFixed(0)], top: +top.toFixed(1), minVy: +minVy.toFixed(1) }
    }
  })
  // ---- PASTO --------------------------------------------------------------
  await page.evaluate(() => { window.__capy.hud.cross('pasto') })
  await page.waitForTimeout(9000)
  out.pasto = await page.evaluate(() => {
    const g = window.__capy, Q = window.__L5B
    const r = { biome: g.biome.current }
    Q.tp(13, 4, 30)
    r.summon = Q.summon(); r.mount = Q.mount()
    if (g.condor.state !== 'carrying') return r
    const th = g.pasto.thermals
    // the plaza column to 45, the east flank to 70, the crater column to 80, then over the crater axis
    Q.tick(120); Q.lift(75)
    r.cross = Q.fly(null, 0, -40, -70, 4, 40, 3000)
    r.cross2 = Q.fly(null, 0, -40 + 30, -70 + 30, 8, 30, 1500)
    r.plume = g.pasto.rideAudit ? g.pasto.rideAudit() : null
    // the dive: tuck, straight, from height
    const slow0 = Q.slow, shots0 = Q.shots
    r.dive = Q.fly(null, 0, 130, 120, 8, 0, 1500, true)
    r.diveSlow = Q.slow - slow0; r.diveShots = Q.shots - shots0
    r.audit = g.pasto.rideAudit ? g.pasto.rideAudit() : null
    r.toasts = Q.toasts.slice(); Q.toasts.length = 0
    r.rec = g.hud.recordAudit().live
    return r
  })
  // ---- RIO -----------------------------------------------------------------
  await page.evaluate(() => { window.__capy.hud.cross('rio') })
  await page.waitForTimeout(9000)
  out.rio = await page.evaluate(() => {
    const g = window.__capy, Q = window.__L5B
    const r = { biome: g.biome.current }
    Q.tp(0, g.rio.terrainHeight(0, 46) + 1.2, 46)
    r.summon = Q.summon(); r.mount = Q.mount()
    if (g.condor.state !== 'carrying') return r
    const th = g.rio.thermals
    Q.tick(120); Q.lift(90)
    // east over the loaf (r 30, y > 54), the harness having lifted the bird to height
    r.loaf = Q.fly(null, 0, 96, -54, 30, 54, 4000)
    r.chain1 = g.rio.chainAudit ? g.rio.chainAudit() : null
    // across the city to the Corcovado thermal, up to 100, past the Redentor (r 40, y > 76)
    Q.lift(40)
    r.christ = Q.fly(null, 0, -96, 78, 36, 76, 6000)
    r.chain2 = g.rio.chainAudit ? g.rio.chainAudit() : null
    // and down low over the arches at Lapa (r 34, under base + 35)
    const slow0 = Q.slow, shots0 = Q.shots
    // ...and a descent: the bird glides at ten to one, so a hundred metres down is a kilometre of city — a loop out over the bay first, tucked
    r.down = Q.fly(null, 0, 60, -60, 30, 0, 3000, true)
    r.down2 = Q.fly(null, 0, -60, -40, 30, 0, 3000, true)
    r.down3 = Q.fly(null, 0, 40, 20, 30, 0, 3000, true)
    r.lapa = Q.fly(null, 0, -28, 76, 20, 0, 4000, true)
    r.lapaSlow = Q.slow - slow0; r.lapaShots = Q.shots - shots0
    r.chain3 = g.rio.chainAudit ? g.rio.chainAudit() : null
    // let go, and the record files
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'KeyE', bubbles: true })); g.tick(1 / 60, false)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', key: 'KeyE', bubbles: true })); g.input.actionPressed = true; g.tick(1 / 60, false); g.input.actionPressed = false
    Q.tick(120)
    r.state = g.condor.state
    r.record = g.hud.recordAudit().best['fragata-ride']
    r.toasts = Q.toasts.slice()
    return r
  })
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=l5-birds.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
  return out
}
