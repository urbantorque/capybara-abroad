async page => {
  await page.reload()
  await page.waitForTimeout(6000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const out = await page.evaluate(() => {
    const g = window.__capy
    const R = { rows: [] }
    const spots = [
      ['pasto', 9, 35], ['pasto', 0, 26], ['pasto', -6, 30], ['pasto', 14, 20],
      ['quay', 0, 0], ['kyoto', 0, 0], ['manly', 0, 0]
    ]
    for (const [bi, ox, oz] of spots) {
      g.biome.switchTo('quay')
      for (let i = 0; i < 20; i++) g.tick(1 / 60, false)
      g.biome.switchTo(bi)
      for (let i = 0; i < 60; i++) g.tick(1 / 60, false)
      const b = g.capy.body
      const sp = g.biome.spawnOf(bi)
      const X = bi === 'pasto' ? ox : sp.x + ox
      const Z = bi === 'pasto' ? oz : sp.z + oz
      b.position.set(X, sp.y + 0.6, Z)
      b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      g.input.x = 0; g.input.z = 0
      for (let i = 0; i < 240; i++) g.tick(1 / 60, false)
      // rest height, and the terrain the controller's backstop reads
      const restY = b.position.y
      const terr = (g.env && g.env.groundY) ? g.env.groundY(b.position.x, b.position.z) : null
      let ys = [], vys = [], hops = 0
      for (let i = 0; i < 60 * 10; i++) {
        g.tick(1 / 60, false)
        ys.push(b.position.y)
        if (b.velocity.y > 0.5) { hops++; vys.push(+b.velocity.y.toFixed(2)) }
      }
      R.rows.push({
        biome: g.biome.current, at: [+b.position.x.toFixed(2), +b.position.z.toFixed(2)],
        restY: +restY.toFixed(4), terr: terr === null ? null : +terr.toFixed(4),
        yMin: +Math.min.apply(null, ys).toFixed(4),
        yMax: +Math.max.apply(null, ys).toFixed(4),
        upFrames: hops, upSample: vys.slice(0, 5),
        drift10s: +Math.hypot(b.position.x - X, b.position.z - Z).toFixed(3)
      })
    }
    R.err = g.state.lastError || null
    return R
  })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b8-gap.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
