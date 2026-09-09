async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const shots = [
    ['F3-pan-road','pantanal', 0, 62, 7.4, 7.4, 0, 0, -8],
    ['F3-pan-campo','pantanal', 24, 22, 12, 16, 0, 0, -14],
    ['F3-pan-baia','pantanal', -40, 10, 10, 14, 0, 0, -14],
    ['F3-cav-entrance','cave', 4, 40, 12, 18, 0, -3, -18],
    ['F3-cav-passage','cave', 6, -12, 16, 26, 0, -6, -26],
    ['F3-cav-doline','cave', 4, -22, 24, 40, 0, -6, -30],
    ['F3-ant-station','antarctic', -6, 62, 16, 26, 0, 2, -20],
    ['F3-ant-colony','antarctic', 24, 96, 18, 26, 0, 6, -20],
    ['F3-ant-channel','antarctic', 8, -180, 26, 44, 0, -2, -40],
  ]
  for (const s of shots) {
    await page.evaluate((a) => {
      const g = window.__capy
      if (g.biome.current !== a[1]) g.biome.switchTo(a[1])
      const api = g[a[1]]
      const b = g.capy.body
      const y = Math.max(api.terrainHeight(a[2], a[3]) + 0.6, api.waterLevel + 0.3)
      b.position.set(a[2], y, a[3]); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }, s)
    await page.waitForTimeout(2200)
    await page.evaluate(async (a) => {
      const g = window.__capy
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280/760; g.camera.updateProjectionMatrix()
      const p = g.capy.position
      g.camera.position.set(p.x, p.y + a[4], p.z + a[5])
      g.camera.lookAt(p.x + a[6], p.y + a[7], p.z + a[8])
      g.camera.updateMatrixWorld(true)
      g.post.render()
      await fetch('/shot?name=' + a[0], { method:'POST', body: g.renderer.domElement.toDataURL('image/png') })
    }, s)
  }
}
