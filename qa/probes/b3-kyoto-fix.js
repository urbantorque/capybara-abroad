async page => {
  const errs = []
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 160)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(6500)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)

  const out = await page.evaluate(async () => {
    const g = window.__capy
    const R = { issues: [] }
    const settle = n => { for (let i = 0; i < n; i++) g.tick(1 / 60, false) }
    g.biome.switchTo('kyoto')
    const sp = g.biome.spawnOf('kyoto'), b = g.capy.body
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    settle(120)
    const K = g.kyoto

    // ---- 1. THE LATCH. Float in the mill pond and count the payouts. ------
    let chimes = 0, records = 0, toasts = 0
    const sfx0 = g.sfx, rec0 = g.record, toast0 = g.toast
    const seen = []
    g.sfx = function (n, o) { if (n === 'chime') { chimes++; seen.push(!!(o && o.at)) } return sfx0.apply(g, arguments) }
    g.record = function (id, v) { if (id === 'uji-run') { records++; R.lastRec = +(+v).toFixed(2) } return rec0.apply(g, arguments) }
    g.toast = function () { toasts++; return toast0.apply(g, arguments) }
    const mill = K.mill
    b.position.set(mill.x, -1.1, mill.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    settle(60 * 30)
    R.wet = +(g.capy.wet||0).toFixed(2); R.chimesIn30s = chimes
    R.recordsIn30s = records
    R.toastsIn30s = toasts
    R.runBest = +K.runBest().toFixed(2)
    R.chimePositional = seen.length ? seen.every(Boolean) : null
    g.sfx = sfx0; g.record = rec0; g.toast = toast0
    if (chimes > 2) R.issues.push('the marquee still fires ' + chimes + ' times in 30 s')
    if (chimes === 0) R.issues.push('THE PROBE ARMED NOTHING: 0 chimes means this measured an empty run, not a fixed one')
    if (R.runBest > 0 && R.runBest < 5) R.issues.push('a sub-5 s run was recorded: ' + R.runBest)

    // ---- 2. THE SURFACE LADDER. Uji, bamboo, torii, and the sand default. -
    const pitchAt = (x, z) => {
      b.position.set(x, (K.terrainHeight ? K.terrainHeight(x, z) : 0) + 0.4, z)
      b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      settle(4)
      return g.capy.surfacePitch !== undefined ? g.capy.surfacePitch : null
    }
    R.zones = {
      ujiTown:   K.inZone('uji', 24, 176),
      bambooFar: K.inZone('bamboo', -84, -44),
      toriiMid:  K.inZone('torii', -34, -100)
    }
    if (!R.zones.ujiTown) R.issues.push('inZone(uji) is false at the town centre')

    // ---- 3. LIT. The grade must move while the river carries you. ---------
    R.runFlowApi = typeof K.runFlow === 'function'
    if (!R.runFlowApi) R.issues.push('kyoto.runFlow() is not published')
    else {
      // dry
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      settle(60)
      const dryBloom = g.renderer && g.state ? null : null
      R.flowDry = +K.runFlow().toFixed(3)
      // in the river, upstream
      const riv = { x: mill.x - 60, z: mill.z - 60 }
      b.position.set(riv.x, -0.5, riv.z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      settle(90)
      R.flowWet = +K.runFlow().toFixed(3)
      R.inRiver = K.inRiver()
    }

    // ---- 4. THE HERON HOLDS. -------------------------------------------
    R.dryApi = typeof K.dryCrossing === 'function'
    if (!R.dryApi) R.issues.push('kyoto.dryCrossing() is not published')

    // ---- 5. SOMETHING EDIBLE, AT LAST. ---------------------------------
    const live = g.biome.current
    let edible = 0, dango = 0
    for (const p of g.props) {
      if (p.removed || p.hidden) continue
      if (p.biome && p.biome !== live) continue
      const d = g.physics && g.physics.typeOf ? g.physics.typeOf(p) : null
      if (p.type === 'dango' || d === 'dango') dango++
      if (p.edible || (p.def && p.def.edible)) edible++
    }
    R.dangoInWorld = dango
    R.edibleInWorld = edible
    if (dango === 0) R.issues.push('no dango scattered in Kyoto')

    R.lastError = g.state.lastError || null
    return R
  })
  out.pageErrors = errs
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b3-kyoto-fix.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
