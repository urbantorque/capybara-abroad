async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(7000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  // Arm a legal run, then let rAF carry the payout so the framing envelope
  // runs on the real clock and the picture is what a player would see.
  await page.evaluate(() => {
    const g = window.__capy
    const settle = n => { for (let i = 0; i < n; i++) g.tick(1 / 60, false) }
    g.biome.switchTo('kyoto')
    const b = g.capy.body, K = g.kyoto
    const put = (x, y, z) => {
      b.position.set(x, y, z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }
    put(K.bridge.x, -0.6, K.bridge.z); settle(20)
    for (let i = 0; i < 60 * 12; i++) { put(K.bridge.x, -0.6, K.bridge.z); settle(1) }
    for (let k = 1; k <= 9; k++) {
      const f = k / 10
      put(K.bridge.x + (K.mill.x - K.bridge.x) * f, -0.7,
          K.bridge.z + (K.mill.z - K.bridge.z) * f)
      settle(8)
    }
    // one hop short of the circle; the last step is left to the live frames
    window.__lastHop = () => {
      put(K.mill.x, -0.7, K.mill.z)
    }
  })
  await page.evaluate(() => window.__lastHop())
  await page.waitForTimeout(900)          // inside the 2.6 s hold
}
