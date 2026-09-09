async page => {
  await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('manly')
    await new Promise(r => setTimeout(r, 900))
    const m = g.manly, b = g.capy.body
    b.position.set(58, m.terrainHeight(58, 26) + 0.5, 26)
    b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    g.input.camYaw = Math.PI * 0.5
    for (let i = 0; i < 240; i++) g.tick(1/60, false)
  })
  await page.waitForTimeout(700)
}
