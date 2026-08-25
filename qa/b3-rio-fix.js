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
    g.biome.switchTo('rio')
    const sp = g.biome.spawnOf('rio'), b = g.capy.body
    const put = (x, y, z) => {
      b.position.set(x, y, z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }
    put(sp.x, sp.y, sp.z); settle(120)
    const RI = g.rio

    // ---- 1. THE WAVE. The animal must ride ON it, not 1.56 m under it. ----
    // Swim out to the break and wait for a crest.
    const w = RI.waveAt()
    put(w.x, 0.0, w.z + 6)
    let worst = 99, best = -99, samples = 0
    for (let i = 0; i < 60 * 40; i++) {
      settle(1)
      const p = g.capy.position
      if (!RI.isOverWater(p.x, p.z)) continue
      const surf = RI.waterHeightAt(p.x, p.z)
      const d = p.y - surf
      if (d < worst) worst = d
      if (d > best) best = d
      samples++
    }
    R.samplesOverWater = samples
    R.worstDepthBelowSurface = +worst.toFixed(3)
    R.bestAboveSurface = +best.toFixed(3)
    if (samples === 0) R.issues.push('THIS PROBE NEVER GOT OVER WATER — it measured nothing')
    else if (worst < -0.75) R.issues.push('the animal sat ' + (-worst).toFixed(2) + ' m under the surface')

    // ---- 2. THE KIOSK must require the counter. --------------------------
    // RI.kiosk is the STAND point, 2.4 m seaward of the drum. The crates and
    // the counter are placed off the drum centre, so recover it.
    const k = { x: RI.kiosk.x, z: RI.kiosk.z + 2.4 }
    const ground = RI.terrainHeight(k.x, k.z)
    put(k.x, ground + 0.34, k.z - 2.4)
    g.input.action = true; g.input.actionPressed = true
    settle(6)
    g.input.action = false; g.input.actionPressed = false
    settle(30)
    R.kioskFromSand = !!g.taskDone && g.taskDone('kiosk')
    if (R.kioskFromSand === undefined) R.kioskFromSand = null
    if (R.kioskFromSand === true) R.issues.push('the kiosk still ticks from the sand')

    // ---- 3. THE LADDER. Every rise must be under the 0.70 m hop. ---------
    // Probe the solid tops of the crate stack by dropping onto each in turn.
    const tops = []
    for (const dy of [1.2, 1.8, 2.4, 3.2]) {
      put(k.x + 2.1, ground + dy, k.z - 2.0)
      settle(70)
      tops.push(+(g.capy.position.y).toFixed(2))
    }
    R.restHeights = tops
    // and the counter itself must be standable
    put(k.x, ground + 3.0, k.z - 2.2)
    settle(90)
    R.counterRest = +(g.capy.position.y).toFixed(2)
    R.counterTarget = +(ground + 2.11).toFixed(2)
    if (Math.abs(R.counterRest - R.counterTarget) > 0.45)
      R.issues.push('dropped on the counter the animal rested at ' + R.counterRest + ', not ' + R.counterTarget)

    // ---- 4. THE ARCHES have a footfall answer now. -----------------------
    R.arches = RI.inZone('santateresa', -28, 76)
    R.selaron = RI.inZone('santateresa', 0, 100)
    R.notBeach = RI.inZone('santateresa', 0, 10)
    if (!R.arches) R.issues.push('the aqueduct at (-28, 76) is still in no zone')
    if (R.notBeach) R.issues.push('the santateresa zone now swallows the beach')

    // ---- 5. salute() is published, so the chapter can be lit. ------------
    R.saluteApi = typeof RI.salute === 'function'
    if (!R.saluteApi) R.issues.push('rio.salute() is not published')

    // ---- 6. something edible on the beach at last -----------------------
    const live = g.biome.current
    let ice = 0
    for (const p of g.props) {
      if (p.removed || p.hidden) continue
      if (p.biome && p.biome !== live) continue
      if (p.type === 'icecream') ice++
    }
    R.icecreamInWorld = ice
    if (ice === 0) R.issues.push('no edible prop scattered in Rio')

    R.lastError = g.state.lastError || null
    return R
  })
  out.pageErrors = errs
  await page.evaluate(async o => {
    await fetch('/shot?name=b3-rio-fix.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
