async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(7000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  await page.evaluate(() => {
    const g = window.__capy
    const settle = n => { for (let i = 0; i < n; i++) g.tick(1 / 60, false) }
    g.biome.switchTo('iceland')
    const sp = g.biome.spawnOf('iceland'), b = g.capy.body
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    settle(120)
    const I = g.iceland
    const pool = I.spring || I.pool || { x: -40, z: -10 }
    b.position.set(pool.x, 0.2, pool.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    // soak until the sky is most of the way up, then leave the rest to rAF
    for (let i = 0; i < 60 * 60; i++) { settle(1); if (I.skyward && I.skyward() > 0.9) break }
    for (let i = 0; i < 60 * 3; i++) settle(1)
  })
  await page.waitForTimeout(1200)
}
