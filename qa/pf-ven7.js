async page => {
  await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('venice')
    const V = g.venice, b = g.capy.body
    b.position.set(-4, V.terrainHeight(-4, -35) + 0.6, -35); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 240; i++) g.tick(1 / 60, false)
    for (let i = 0; i < 300 * 60 && !(V.tide() > 0.60 && V.tide() < 0.68); i++) g.tick(1 / 60, false)
    b.position.set(-4, V.terrainHeight(-4, -35) + 0.6, -35); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    window.__venT = V.tide()
  })
  await page.waitForTimeout(1800)
}
