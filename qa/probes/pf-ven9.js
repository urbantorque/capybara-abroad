async page => {
  const out = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('venice')
    const V = g.venice, b = g.capy.body
    const sp = g.biome.spawnOf('venice')
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    const r = { trace: [] }
    for (let i = 0; i < 100 * 60; i++) {
      g.tick(1 / 60, false)
      if (i % (10 * 60) === 0) r.trace.push([Math.round(i / 60),
        +(g.capy.loaf || 0).toFixed(2), +(g.calm ? g.calm() : -1).toFixed(2)])
    }
    r.finalLoaf = +(g.capy.loaf || 0).toFixed(3)
    r.slipK = g.weather && g.weather.mood ? g.weather.mood().slipK : 'n/a'
    r.wetness = g.weather && g.weather.wetness ? +g.weather.wetness().toFixed(3) : 'n/a'
    r.hasGroundSlip = typeof V.groundSlip === 'function'
    r.hasSoaking = typeof V.soaking === 'function'
    r.hasLocalWater = typeof V.localWater === 'function'
    return r
  })
  await page.evaluate(async (d) => {
    const bb = btoa(unescape(encodeURIComponent(JSON.stringify(d))))
    await fetch('/shot?name=venG.json', { method: 'POST', body: bb })
  }, out)
}
