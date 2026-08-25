async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(1800)
  const out = await page.evaluate(() => {
    const g = window.__capy
    const R = {}
    g.biome.switchTo('pasto')
    const sp = g.biome.spawnOf('pasto'), b = g.capy.body
    const start = { x: sp.x + 9, y: sp.y, z: sp.z + 9 }
    b.position.set(start.x, start.y, start.z)
    b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    g.input.x = 0; g.input.z = 0; g.input.action = false; g.input.run = false
    R.spawn = { x: +sp.x.toFixed(2), y: +sp.y.toFixed(2), z: +sp.z.toFixed(2) }
    R.start = { x: +start.x.toFixed(2), y: +start.y.toFixed(2), z: +start.z.toFixed(2) }
    const api = g.biome.api && g.biome.api()
    R.hasSlopeAt = !!(api && api.slopeAt)
    R.hasGroundY = !!(api && api.groundY)
    R.groundAtStart = api && api.groundY ? +api.groundY(start.x, start.z).toFixed(3) : null
    R.slopeAtStart = api && api.slopeAt ? +api.slopeAt(start.x, start.z).toFixed(4) : null
    // sample the CONTACT triangle: what the collision heightfield actually says,
    // by dropping a probe body and reading where it rests over a 3 m cross
    R.probe = []
    for (const d of [[0, 0], [1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5], [3, 3], [-3, -3]]) {
      const x = start.x + d[0], z = start.z + d[1]
      R.probe.push([d[0], d[1],
        api && api.groundY ? +api.groundY(x, z).toFixed(3) : null,
        api && api.slopeAt ? +api.slopeAt(x, z).toFixed(4) : null])
    }
    const trail = []
    for (let s = 0; s < 60; s++) {
      for (let i = 0; i < 60; i++) g.tick(1 / 60, false)
      if (s % 10 === 9) trail.push([s + 1, +b.position.x.toFixed(2), +b.position.y.toFixed(2),
                                    +b.position.z.toFixed(2),
                                    +Math.hypot(b.velocity.x, b.velocity.z).toFixed(3)])
    }
    R.trail = trail
    R.end = { x: +b.position.x.toFixed(2), y: +b.position.y.toFixed(2), z: +b.position.z.toFixed(2) }
    R.moved = +Math.hypot(b.position.x - start.x, b.position.z - start.z).toFixed(2)
    R.groundAtEnd = api && api.groundY ? +api.groundY(b.position.x, b.position.z).toFixed(3) : null
    R.loaf = g.capy.loaf != null ? +g.capy.loaf.toFixed(2) : null
    R.grounded = g.capy.grounded
    R.err = g.state.lastError || null
    return R
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=b4-pasto.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
