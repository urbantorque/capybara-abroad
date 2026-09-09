async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(7000)
  const out = await page.evaluate(() => {
    const g = window.__capy, o = {}
    g.biome.switchTo('kowloon')
    const b = g.capy.body, inp = g.input
    b.position.set(-8.2, 0.4, 0); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    let peak = -99, peakX = 0
    for (let i = 0; i < 60 * 90; i++) {
      inp.camYaw = 0; inp.x = -1; inp.z = 0; inp.action = true; inp.run = false
      g.tick(1 / 60, false)
      if (b.position.y > peak) { peak = b.position.y; peakX = b.position.x }
    }
    o.peak = +peak.toFixed(3); o.peakX = +peakX.toFixed(3)
    o.at = [+b.position.x.toFixed(2), +b.position.y.toFixed(2), +b.position.z.toFixed(2)]
    // every static box whose footprint covers the climb line, sorted by height
    const near = []
    for (const bd of g.world.bodies) {
      if (bd.type === 4 || bd === b) continue
      for (const sh of bd.shapes) {
        if (sh.type !== 4 || !sh.halfExtents) continue
        const c = bd.position
        const he = sh.halfExtents
        if (c.y + he.y < 25 || c.y - he.y > 40) continue
        if (Math.abs(c.z - b.position.z) > he.z + 1) continue
        near.push({
          cx: +c.x.toFixed(2), cy: +c.y.toFixed(2), cz: +c.z.toFixed(2),
          hx: +he.x.toFixed(2), hy: +he.y.toFixed(2), hz: +he.z.toFixed(2),
          x0: +(c.x - he.x).toFixed(2), x1: +(c.x + he.x).toFixed(2),
          top: +(c.y + he.y).toFixed(2), bot: +(c.y - he.y).toFixed(2)
        })
      }
    }
    near.sort((p, q) => p.top - q.top)
    o.near = near
    o.contacts = g.world.contacts.filter(c => c.bi === b || c.bj === b).length
    o.err = g.state.lastError || null
    return o
  })
  await page.evaluate(async (d) => {
    await fetch('/shot?name=b8-hkroof2.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(d, null, 1)))) })
  }, out)
}
