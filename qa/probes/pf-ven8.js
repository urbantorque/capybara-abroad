async page => {
  await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('venice')
    const V = g.venice, b = g.capy.body
    const ty = V.terrainHeight(-56, -2)
    b.position.set(-56, ty + 0.6, -2); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 240; i++) g.tick(1 / 60, false)
    window.__d = { ty, y: g.capy.position.y, ow: V.isOverWater(-56, -2) }
  })
  await page.waitForTimeout(1500)
}
