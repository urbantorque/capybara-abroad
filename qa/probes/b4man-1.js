async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch(e){} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
    const g = window.__capy
    g.biome.switchTo('manly'); await sleep(1200)
    const m = g.manly
    const o = { ok: !!m, built: m && m.built(), active: g.biome.isActive('manly') }
    o.localWater = m.localWater
    o.waterLevel = m.waterLevel
    // water is a FUNCTION of position: sample a shore-normal transect
    o.transect = []
    for (let z = -70; z <= 30; z += 10) {
      o.transect.push([z, +m.waterHeightAt(0, z).toFixed(3), +m.terrainHeight(0, z).toFixed(2),
                       +m.wave(0, z).push.toFixed(2), +m.wave(0, z).foam.toFixed(2)])
    }
    // does the surface actually vary in space at one instant?
    let lo = 9, hi = -9
    for (let z = -70; z <= 26; z += 2) { const y = m.waterHeightAt(0, z); if (y < lo) lo = y; if (y > hi) hi = y }
    o.reliefAtOneInstant = +(hi - lo).toFixed(3)
    // ---- surfacePitch coverage over the whole walkable map ----
    const B = { x0: -110, x1: 120, z0: -90, z1: 90 }
    const hist = {}
    let n = 0
    for (let x = B.x0; x <= B.x1; x += 2) for (let z = B.z0; z <= B.z1; z += 2) {
      const ty = m.terrainHeight(x, z)
      if (ty < m.waterLevel - 0.2) continue          // sea floor, not walked
      const p = +m.surfacePitch(x, z, ty).toFixed(3)
      hist[p] = (hist[p] || 0) + 1; n++
    }
    o.surfHist = hist; o.surfCells = n
    // named places, and what each one footfalls as
    const spots = { spawn:[0,46], beach:[0,28], waterline:[0,24], flags:[m.flags().x, m.flags().z],
      club:[24,47], clubRoof:[24,47], corso:[0,60], pool:[(60+82)/2, 15], poolDeck:[62.5,24.6],
      shelly:[84,-20], point:[60,-12], bommie:[40,-46], pines:[0,39.5], dune:[0,35] }
    o.spot = {}
    for (const k in spots) { const s = spots[k]
      o.spot[k] = { pitch: +m.surfacePitch(s[0], s[1], m.terrainHeight(s[0], s[1])).toFixed(3),
                    y: +m.terrainHeight(s[0], s[1]).toFixed(2) } }
    // ---- the locals, and how far each is from where a ride lands ----
    o.locals = (g.debugLocals ? g.debugLocals() : null)
    return o
  })
  await page.evaluate(async o => { await fetch('/shot?name=b4man-1.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}) }, out)
}
