async page => {
  await page.reload()
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = {}
  out.drift = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('drift')
    const sp = g.biome.spawnOf('drift'), b = g.capy.body
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
    const live = g.biome.current
    const all = g.props.filter(p => !p.removed && !p.hidden && !p.held && !p.keep &&
      !p.planted && !p.frozen && (!p.biome || p.biome === live))
    const census = all.map(p => ({ t: p.type, m: +p.mass.toFixed(2),
      x: +p.body.position.x.toFixed(1), y: +p.body.position.y.toFixed(1), z: +p.body.position.z.toFixed(1),
      hx: +(p.homeX || 0).toFixed(1), hz: +(p.homeZ || 0).toFixed(1), w: !!p.inWater }))
    const cand = all.filter(p => p.mass > 0 && p.mass <= 0.6 && !p.inWater)
    if (!cand.length) return { note: 'no light prop', census, spawn: sp }
    cand.sort((a, c) => a.mass - c.mass)
    const p = cand[0]
    const px = sp.x + 3, pz = sp.z + 3
    p.homeX = px; p.homeZ = pz
    p.body.wakeUp()
    p.body.position.set(px, sp.y + 0.6, pz)
    p.body.previousPosition.copy(p.body.position)
    p.body.interpolatedPosition.copy(p.body.position)
    p.body.velocity.set(0, 0, 0); p.body.angularVelocity.set(0, 0, 0)
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
    const x0 = p.body.position.x, z0 = p.body.position.z, y0 = p.body.position.y
    let effMax = 0, effSum = 0, k = 0, awake = 0, path = 0, overKick = 0
    let bioMax = 0, wxMax = 0
    let lx = x0, lz = z0
    for (let i = 0; i < 60 * 40; i++) {
      g.tick(1 / 60, false)
      if (p.inWater) return { note: 'it went in the water', type: p.type, census, spawn: sp }
      const nx = p.body.position.x, nz = p.body.position.z
      path += Math.hypot(nx - lx, nz - lz); lx = nx; lz = nz
      if (p.body.sleepState !== 2) awake++
      if (i % 6 === 0) {
        const wg = g.weather && g.weather.gust ? g.weather.gust() : { x: 0, z: 0 }
        const raw = Math.hypot(wg.x || 0, wg.z || 0)
        wxMax = Math.max(wxMax, raw)
        const s = raw > 2.8 ? (raw - 2.8) * 1.2 : 0
        const bw = g.drift.wind()
        const bm = Math.hypot(bw.x, bw.z)
        bioMax = Math.max(bioMax, bm)
        const eff = bm + s
        if (eff >= 2.0) overKick++
        effMax = Math.max(effMax, eff); effSum += eff; k++
      }
    }
    return { type: p.type, mass: +p.mass.toFixed(2),
      net: +Math.hypot(p.body.position.x - x0, p.body.position.z - z0).toFixed(2),
      dy: +(p.body.position.y - y0).toFixed(2),
      path: +path.toFixed(2),
      awakeFrac: +(awake / (60 * 40)).toFixed(2),
      effMax: +effMax.toFixed(2), effMean: +(effSum / Math.max(1, k)).toFixed(2),
      biomeWindMax: +bioMax.toFixed(2), wxGustMax: +wxMax.toFixed(2),
      fracOverKickThresh: +(overKick / Math.max(1, k)).toFixed(2),
      gravY: g.world.gravity.y,
      lightProps: cand.length, totalProps: all.length,
      census, spawn: sp }
  })
  await page.evaluate(async o => {
    await fetch('/shot?name=p3dgust.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
