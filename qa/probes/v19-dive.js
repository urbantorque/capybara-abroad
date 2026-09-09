async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.keyboard.press('Digit0')
  await page.waitForTimeout(6000)
  const spot = await page.evaluate(() => {
    const g = window.__capy
    const api = g.venice
    let best = null, bestD = 0
    for (let x = -120; x <= 120; x += 3) {
      for (let z = -120; z <= 120; z += 3) {
        if (!api.isOverWater(x, z)) continue
        const d = (api.waterLevel) - api.terrainHeight(x, z)
        if (d > bestD) { bestD = d; best = { x: x, z: z, d: d } }
      }
    }
    return best
  })
  await page.evaluate((s) => {
    const g = window.__capy
    const b = g.capy.body
    b.position.set(s.x, 0.4, s.z)
    b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position)
    b.interpolatedPosition.copy(b.position)
  }, spot)
  await page.waitForTimeout(2500)
  await page.screenshot({ path: 'qa/shot-dive-surface.png' })
  await page.keyboard.down('e')
  await page.waitForTimeout(3500)
  await page.screenshot({ path: 'qa/shot-dive-under.png' })
  const out = await page.evaluate((s) => {
    const g = window.__capy
    const c = g.capy
    return { spot: s, swimming: c.swimming, diving: c.diving,
             depth: Number((c.depth || 0).toFixed(2)),
             capyY: Number(c.position.y.toFixed(2)),
             camY: Number(g.camera.position.y.toFixed(2)),
             fogNear: g.scene.fog ? Number(g.scene.fog.near.toFixed(1)) : null,
             fogFar: g.scene.fog ? Number(g.scene.fog.far.toFixed(1)) : null,
             err: g.state.lastError || null }
  }, spot)
  await page.keyboard.up('e')
  await page.evaluate(async (o) => {
    await fetch('/shot?name=v19dive.json', {
      method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    })
  }, out)
  return 'ok'
}
