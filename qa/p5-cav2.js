async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  await page.evaluate(() => { const g = window.__capy; g.biome.switchTo('cave'); g.state.lastError = null })
  await page.waitForTimeout(2000)
  const cams = [
    ['cav-doline2', 4, 26, -14, 4, 6, -48],
    ['cav-camp2', 30, 14, -30, 17, 3, -46],
    ['cav-fall', -6, 12, -22, -12, 6, -44],
    ['cav-pass2', -8, 16, 24, -18, -2, -30],
  ]
  for (const c of cams) {
    await page.evaluate((a) => {
      const g = window.__capy
      const b = g.capy.body
      b.position.set(a[1], a[2] + 1, a[3]); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }, c)
    await page.waitForTimeout(1600)
    await page.evaluate(async (a) => {
      const g = window.__capy
      g.renderer.setSize(1280, 760, false)
      g.tick(1/60, true)
      g.camera.position.set(a[1], a[2], a[3])
      g.camera.lookAt(a[4], a[5], a[6])
      g.renderer.render(g.scene, g.camera)
      await fetch('/shot?name=' + a[0], { method:'POST', body: g.renderer.domElement.toDataURL('image/png') })
    }, c)
  }
}
