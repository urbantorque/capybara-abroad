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
      const ter = g.antarctic.terrainHeight
      b.position.set(q.px, ter(q.px,q.pz)+0.5, q.pz); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i=0;i<(q.warm||140);i++) {
        g.tick(1/60, false)
        b.position.set(q.px, ter(q.px,q.pz)+0.5, q.pz); b.velocity.set(0,0,0)
      }
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280/760; g.camera.fov = q.fov||50; g.camera.far = 3000
      g.camera.updateProjectionMatrix()
      g.camera.position.set(q.cx, q.cy, q.cz)
      g.camera.lookAt(new THREE.Vector3(q.tx, q.ty, q.tz))
      g.camera.updateMatrixWorld(true)
      g.renderer.render(g.scene, g.camera)
      const d = g.renderer.domElement.toDataURL('image/png')
      await fetch('/shot?name=' + q.name, { method:'POST', body: d.split(',')[1] })
    }, o)
  }
  await cam({ biome:'antarctic', px:24, pz:92, warm:260, cx:24, cy:34, cz:126, tx:24, ty:13, tz:90, name:'L-ant-colony.png' })
  await cam({ biome:'antarctic', px:24, pz:92, warm:400, cx:34, cy:22, cz:106, tx:22, ty:13, tz:86, name:'L-ant-col2.png' })
  await cam({ biome:'antarctic', px:0, pz:-330, warm:150, cx:0, cy:16, cz:-270, tx:0, ty:8, tz:-380, name:'L-ant-gate.png' })
  await cam({ biome:'antarctic', px:114, pz:16, warm:150, cx:126, cy:9, cz:30, tx:110, ty:2, tz:8, name:'L-ant-bones.png' })
}
