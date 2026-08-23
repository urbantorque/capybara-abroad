async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const at = await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('pantanal')
    return null
  })
  await page.waitForTimeout(1500)
  await page.evaluate(() => {
    const g = window.__capy
    const b = g.capy.body
    b.position.set(60, 4, 40); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    g.input.camYaw = 1.2
    // stand the rig up so the crowns are in frame
    g.camera.position.set(60, 22, 66)
    g.camera.lookAt(40, 8, 30)
  })
  await page.waitForTimeout(200)
  await page.evaluate(async () => {
    const g = window.__capy
    g.renderer.setSize(1280, 760, false)
    g.renderer.render(g.scene, g.camera)
    await fetch('/shot?name=pan-palm', { method:'POST', body: g.renderer.domElement.toDataURL('image/png') })
  })
}
