async page => {
  await page.reload()
  await page.waitForTimeout(6000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const out = await page.evaluate(() => {
    const g = window.__capy
    const R = { rows: [] }
    g.biome.switchTo('pasto')
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false)
    const b = g.capy.body
    b.position.set(0, 0.34, 26)
    b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    g.input.x = 0; g.input.z = 0
    for (let i = 0; i < 240; i++) g.tick(1 / 60, false)
    const id = (bd) => {
      let k = -1
      for (let i = 0; i < g.world.bodies.length; i++) if (g.world.bodies[i] === bd) k = i
      return k + ':' + bd.type + ':' + bd.shapes.map(s => s.type).join('/') +
             '@' + bd.position.x.toFixed(1) + ',' + bd.position.y.toFixed(1) + ',' + bd.position.z.toFixed(1)
    }
    // what is under the animal every frame, and what happens on a hop frame
    const census = {}
    let hops = []
    for (let i = 0; i < 60 * 20; i++) {
      const before = []
      for (const c of g.world.contacts) {
        const o = c.bi === b ? c.bj : (c.bj === b ? c.bi : null)
        if (o) before.push(id(o))
      }
      const key = Array.from(new Set(before)).sort().join(' + ') || '(none)'
      census[key] = (census[key] || 0) + 1
      const vy0 = b.velocity.y, y0 = b.position.y
      g.tick(1 / 60, false)
      if (b.velocity.y > 0.5 && hops.length < 6) {
        hops.push({ t: +(i / 60).toFixed(2), y0: +y0.toFixed(4), vy0: +vy0.toFixed(3),
                    y1: +b.position.y.toFixed(4), vy1: +b.velocity.y.toFixed(3),
                    under: key })
      }
    }
    R.census = Object.keys(census).map(k => ({ k, n: census[k] })).sort((a, c) => c.n - a.n).slice(0, 8)
    R.hops = hops
    R.capyFootRest = +b.position.y.toFixed(4)
    R.terrainAt = g.pasto && g.pasto.terrainHeight ? +g.pasto.terrainHeight(0, 26).toFixed(4) : null
    R.err = g.state.lastError || null
    return R
  })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b8-hop.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
