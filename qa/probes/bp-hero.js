async page => {
  await page.reload(); await page.waitForTimeout(5500)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const cam = async (o) => {
    await page.evaluate(async (q) => {
      const g = window.__capy, THREE = g.THREE
      if (g.biome.current !== q.biome) { g.biome.switchTo(q.biome) }
      const b = g.capy.body
      const ter = g[q.biome].terrainHeight
      b.position.set(q.px, ter(q.px,q.pz)+0.5, q.pz); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i=0;i<(q.warm||220);i++) {
        g.tick(1/60, false)
        b.position.set(q.px, ter(q.px,q.pz)+0.5, q.pz); b.velocity.set(0,0,0)
      }
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280/760; g.camera.updateProjectionMatrix()
      g.tick(1/60, true)
      const d = g.renderer.domElement.toDataURL('image/png')
      await fetch('/shot?name=' + q.name, { method:'POST', body: d.split(',')[1] })
    }, o)
  }
  await cam({ biome:'cave', px:4, pz:-48, name:'Y-cav-glade.png' })
  await cam({ biome:'cave', px:0, pz:-164, name:'Y-cav-exit.png' })
  await cam({ biome:'cave', px:0, pz:66, name:'Y-cav-spawn.png' })
  await cam({ biome:'antarctic', px:0, pz:50, name:'Y-ant-spawn.png' })
  await cam({ biome:'antarctic', px:-118, pz:-110, name:'Y-ant-blue.png' })
}
