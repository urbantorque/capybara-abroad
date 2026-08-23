async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  await page.evaluate(() => { const g = window.__capy; g.biome.switchTo('antarctic'); g.state.lastError = null })
  await page.waitForTimeout(3000)
  const spots = [['ant-rook', 24, 92, 2.0], ['ant-ribs', 114, 14, 1.2], ['ant-bar', -17, 51, 0.1], ['ant-toe', -92, -110, 1.6]]
  for (const s of spots) {
    await page.evaluate((a) => {
      const g = window.__capy, b = g.capy.body
      b.position.set(a[1], g.antarctic.terrainHeight(a[1], a[2]) + 1.0, a[2]); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      g.input.camYaw = a[3]
    }, s)
    await page.waitForTimeout(2400)
    await page.evaluate(async (name) => {
      const g = window.__capy
      g.renderer.setSize(1280, 760, false)
      g.tick(1/60, true)
      await fetch('/shot?name=' + name, { method:'POST', body: g.renderer.domElement.toDataURL('image/png') })
    }, s[0])
  }
}
