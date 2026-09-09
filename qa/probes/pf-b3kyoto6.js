async page => {
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(7000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('kyoto')
    const b = g.capy.body, K = g.kyoto
    b.position.set(K.mill.x - 9, -0.4, K.mill.z - 9); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 30; i++) g.tick(1 / 60, false)
  })
  await page.waitForTimeout(4000)
}
