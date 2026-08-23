async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('pantanal')
    const b = g.capy.body
    b.position.set(-33, 2, 26); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    g.input.camYaw = 0
  })
  await page.waitForTimeout(3000)
  await page.evaluate(async () => {
    const g = window.__capy
    g.renderer.setSize(1280, 760, false)
    g.tick(1/60, true)
    await fetch('/shot?name=pan-lily', { method:'POST', body: g.renderer.domElement.toDataURL('image/png') })
  })
  // ...and again with the dusk on, which is the only time the flowers exist
  await page.evaluate(() => {
    const g = window.__capy
    g.pantanal.__forceDusk = true
  })
  await page.waitForTimeout(500)
}
