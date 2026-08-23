async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  await page.evaluate(() => { window.__capy.biome.switchTo('quay') })
  await page.waitForTimeout(2000)
  await page.evaluate(() => {
    const g = window.__capy, q = g.quay
    const h = q.boat.helm
    g.capy.body.position.set(h.x, h.y + 0.2, h.z)
    g.capy.body.velocity.set(0, 0, 0)
  })
  await page.waitForTimeout(1400)
  await page.keyboard.press('e')
  await page.waitForTimeout(400)
  await page.keyboard.down('w')
  await page.waitForTimeout(3000)
  await page.keyboard.up('w')
  await page.waitForTimeout(9000)
  await page.evaluate(async (n) => {
    const g = window.__capy
    g.renderer.setSize(1280, 760, false)
    g.camera.aspect = 1280 / 760
    g.camera.updateProjectionMatrix()
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    await fetch('/shot?name=' + n, { method: 'POST', body: g.renderer.domElement.toDataURL('image/png') })
  }, 'quay-helm')
}
