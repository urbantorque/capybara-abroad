async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(7000)
  const out = await page.evaluate(() => {
    const g = window.__capy, o = { issues: [] }
    g.biome.switchTo('kowloon')
    const b = g.capy.body, k = g.kowloon, inp = g.input
    b.position.set(-8.2, 0.4, 0); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    let peak = -99, toppedAt = -1
    for (let i = 0; i < 60 * 60; i++) {
      inp.camYaw = 0; inp.x = -1; inp.z = 0; inp.action = true; inp.run = false
      g.tick(1 / 60, false)
      if (b.position.y > peak) peak = b.position.y
      if (!g.capy.climbing && b.position.y > 34.3) { toppedAt = i; break }
    }
    o.climbPeak = +peak.toFixed(2)
    o.toppedOutAfter = toppedAt < 0 ? null : +(toppedAt / 60).toFixed(1)
    // LET GO. Stand still for four seconds and see what is under it.
    for (let i = 0; i < 60 * 4; i++) { inp.x = 0; inp.z = 0; inp.action = false; g.tick(1 / 60, false) }
    o.afterLetGo = [+b.position.x.toFixed(2), +b.position.y.toFixed(2), +b.position.z.toFixed(2)]
    // closed loop to the roof mark, then stand
    for (let i = 0; i < 60 * 10; i++) {
      const p = g.capy.position, r = k.roof
      const dx = r.x - p.x, dz = r.z - p.z, m = Math.hypot(dx, dz) || 1
      if (m < 1.2) { inp.x = 0; inp.z = 0 }
      else {
        const cy = inp.camYaw || 0
        inp.x = Math.cos(cy) * (dx / m) - Math.sin(cy) * (dz / m)
        inp.z = Math.sin(cy) * (dx / m) + Math.cos(cy) * (dz / m)
      }
      inp.action = false; inp.run = false
      g.tick(1 / 60, false)
    }
    for (let i = 0; i < 60 * 4; i++) { inp.x = 0; inp.z = 0; g.tick(1 / 60, false) }
    o.atRoofMark = [+b.position.x.toFixed(2), +b.position.y.toFixed(2), +b.position.z.toFixed(2)]
    o.onRoof = b.position.y > 34.0
    if (!o.onRoof) o.issues.push('did not end on the 34.2 deck: y ' + b.position.y.toFixed(2))
    if (o.afterLetGo[1] < 34.0) o.issues.push('fell on let-go: y ' + o.afterLetGo[1])
    o.err = g.state.lastError || null
    return o
  })
  await page.evaluate(async (d) => {
    await fetch('/shot?name=b8-hkroof3.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(d, null, 1)))) })
  }, out)
  await page.waitForTimeout(2000)
}
