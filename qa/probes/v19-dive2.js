async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(4500)
  const res = {}
  for (const spec of [['rio', 6], ['iceland', 7], ['pantanal', 15], ['antarctic', 17]]) {
    const name = spec[0]
    const spot = await page.evaluate((n) => {
      const g = window.__capy
      g.biome.switchTo(n)
      for (let i = 0; i < 20; i++) g.tick(1 / 60, false)
      const api = g[n]
      let best = null, bestD = 0
      for (let x = -150; x <= 150; x += 4) {
        for (let z = -150; z <= 150; z += 4) {
          if (!api.isOverWater(x, z)) continue
          const d = api.waterLevel - api.terrainHeight(x, z)
          if (d > bestD && d < 14) { bestD = d; best = { x: x, z: z, d: d } }
        }
      }
      return best
    }, name)
    if (!spot) { res[name] = 'no water'; continue }
    await page.evaluate((s) => {
      const g = window.__capy
      const b = g.capy.body
      b.position.set(s.x, 0.4, s.z)
      b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position)
      b.interpolatedPosition.copy(b.position)
    }, spot)
    await page.waitForTimeout(2200)
    await page.keyboard.down('e')
    await page.waitForTimeout(4500)
    await page.screenshot({ path: 'qa/shot-dive-' + name + '.png' })
    res[name] = await page.evaluate((s) => {
      const g = window.__capy
      const c = g.capy
      return { spot: s, diving: c.diving, depth: Number((c.depth || 0).toFixed(2)),
               capyY: Number(c.position.y.toFixed(2)),
               camY: Number(g.camera.position.y.toFixed(2)),
               fog: g.scene.fog ? [Number(g.scene.fog.near.toFixed(1)), Number(g.scene.fog.far.toFixed(1))] : null,
               err: g.state.lastError || null }
    }, spot)
    await page.keyboard.up('e')
    await page.waitForTimeout(1200)
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=v19dive2.json', {
      method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    })
  }, res)
  return 'ok'
}
