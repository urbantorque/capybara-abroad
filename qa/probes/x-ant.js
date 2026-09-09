async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  await page.evaluate(() => { const g = window.__capy; g.biome.switchTo('antarctic'); for(let i=0;i<200;i++) g.tick(1/60,false) })
  const shots = [
    ['Z-ant-spawn', 0, 7.6, 52, 7.4, 7.4],
    ['Z-ant-colony', 24, 12, 82, 7.4, 7.4],
    ['Z-ant-pack', 10, 2, -180, 9.5, 9.5],
    ['Z-ant-packwide', 10, 2, -180, 40, 60],
    ['Z-ant-glacier', -120, 2, -110, 30, 50],
    ['Z-ant-bones', 114, 2, 20, 7.4, 7.4],
  ]
  for (const s of shots) {
    await page.evaluate((a) => {
      const g = window.__capy
      const b = g.capy.body
      b.position.set(a[1], a[2], a[3]); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }, s)
    await page.waitForTimeout(2400)
    await page.evaluate(async (a) => {
      const g = window.__capy
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280/760; g.camera.updateProjectionMatrix()
      const p = g.capy.position
      g.camera.position.set(p.x, p.y + a[4], p.z + a[5])
      g.camera.lookAt(p.x, p.y + 0.3, p.z - 6)
      g.camera.updateMatrixWorld(true)
      g.post.render()
      await fetch('/shot?name=' + a[0], { method:'POST', body: g.renderer.domElement.toDataURL('image/png') })
    }, s)
  }
}
