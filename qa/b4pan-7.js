async page => {
  await page.evaluate(async () => {
    function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
    const g = window.__capy
    g.biome.switchTo('pantanal'); await sleep(600)
    const b = g.capy.body, m = g.pantanal
    const h = m.terrainHeight(-20, -30)
    b.position.set(-20, h + 0.6, -30); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 60; i++) g.tick(1/60, false)
  })
  await page.waitForTimeout(2500)
}
