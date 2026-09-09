async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const cam = async (o) => {
    await page.evaluate(async (q) => {
      const g = window.__capy, THREE = g.THREE
      if (g.biome.current !== q.biome) { g.biome.switchTo(q.biome) }
      const b = g.capy.body
      const ter = g.cave.terrainHeight
      b.position.set(q.px, ter(q.px,q.pz)+0.5, q.pz); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i=0;i<(q.warm||140);i++) {
        g.tick(1/60, false)
        b.position.set(q.px, ter(q.px,q.pz)+0.5, q.pz); b.velocity.set(0,0,0)
      }
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280/760; g.camera.fov = q.fov||50; g.camera.far = 3000
      g.camera.updateProjectionMatrix()
      if (q.cx !== undefined) {
        g.camera.position.set(q.cx, q.cy, q.cz)
        g.camera.lookAt(new THREE.Vector3(q.tx, q.ty, q.tz))
        g.camera.updateMatrixWorld(true)
        g.renderer.render(g.scene, g.camera)
      } else { g.tick(1/60, true) }
      const d = g.renderer.domElement.toDataURL('image/png')
      await fetch('/shot?name=' + q.name, { method:'POST', body: d.split(',')[1] })
    }, o)
  }
  await cam({ biome:'cave', px:0, pz:-88, warm:200, cx:0, cy:2, cz:-80, tx:2, ty:16, tz:-104, name:'G-cav-wall.png' })
  await cam({ biome:'cave', px:-30, pz:-124, warm:180, cx:-20, cy:16, cz:-124, tx:-46, ty:22, tz:-126, name:'G-cav-roost.png' })
  await cam({ biome:'cave', px:0, pz:64, warm:220, cx:0, cy:9, cz:76, tx:0, ty:3, tz:44, name:'G-cav-spawn.png' })
  await cam({ biome:'cave', px:4, pz:-48, warm:260, cx:22, cy:5, cz:-40, tx:2, ty:20, tz:-52, name:'G-cav-shaft.png' })
}
