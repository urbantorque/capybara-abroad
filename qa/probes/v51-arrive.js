async page => {
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(3000)
  await page.evaluate(async () => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
    const g = window.__capy
    g.biome.switchTo('cali')
    const sp = g.biome.spawnOf('cali'), cb = g.capy.body
    cb.position.set(sp.x, sp.y, sp.z); cb.velocity.set(0, 0, 0)
    cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position)
    await sleep(5000)
  })
}
