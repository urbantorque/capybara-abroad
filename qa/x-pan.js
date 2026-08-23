async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const shots = [
    ['Y-pan-campo', 20, 2, 18, 0],
    ['Y-pan-wide', 20, 2, 40, 0],
    ['Y-pan-river', -34, 2, -60, 0],
    ['Y-pan-bar', 22, 2, -68, 0],
  ]
  await page.evaluate(() => { const g = window.__capy; g.biome.switchTo('pantanal') })
  await page.waitForTimeout(1500)
  for (const s of shots) {
    await page.evaluate((a) => {
      const g = window.__capy
      const b = g.capy.body
      b.position.set(a[1], a[2], a[3]); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      g.input.camYaw = a[4]
    }, s)
    await page.waitForTimeout(2600)
    await page.evaluate(async (name) => {
      const g = window.__capy
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280/760; g.camera.updateProjectionMatrix()
      g.tick(1/60, true)
      await fetch('/shot?name=' + name, { method:'POST', body: g.renderer.domElement.toDataURL('image/png') })
    }, s[0])
  }
}
