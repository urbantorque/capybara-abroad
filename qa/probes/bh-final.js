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
      for (let i=0;i<(q.warm||160);i++) {
        g.tick(1/60, false)
        b.position.set(q.px, ter(q.px,q.pz)+0.5, q.pz); b.velocity.set(0,0,0)
      }
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280/760; g.camera.fov = 50; g.camera.far = 3000
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
  await cam({ biome:'cave', px:0, pz:64, warm:220, cx:0, cy:9, cz:78, tx:0, ty:4, tz:44, name:'Z-cav-1arrive.png' })
  await cam({ biome:'cave', px:4, pz:-30, warm:280, cx:4, cy:12, cz:-2, tx:4, ty:7, tz:-52, name:'Z-cav-2doline.png' })
  await cam({ biome:'cave', px:4, pz:-46, warm:280, cx:20, cy:6, cz:-36, tx:2, ty:20, tz:-52, name:'Z-cav-3shaft.png' })
  await cam({ biome:'cave', px:0, pz:-150, warm:200, cx:0, cy:20, cz:-138, tx:0, ty:17, tz:-186, name:'Z-cav-4slot.png' })
  await cam({ biome:'cave', px:-30, pz:-124, warm:200, cx:-20, cy:16, cz:-124, tx:-46, ty:22, tz:-126, name:'Z-cav-5roost.png' })
  await cam({ biome:'antarctic', px:0, pz:52, warm:200, cx:8, cy:17, cz:70, tx:-4, ty:2, tz:32, name:'Z-ant-1arrive.png' })
  await cam({ biome:'antarctic', px:24, pz:92, warm:300, cx:34, cy:22, cz:106, tx:22, ty:13, tz:86, name:'Z-ant-2colony.png' })
  await cam({ biome:'antarctic', px:108, pz:32, warm:200, cx:128, cy:14, cz:48, tx:104, ty:2, tz:16, name:'Z-ant-3whalers.png' })
  await cam({ biome:'antarctic', px:-120, pz:-110, warm:200, name:'Z-ant-4blue.png' })
  await cam({ biome:'antarctic', px:0, pz:-300, warm:200, cx:0, cy:20, cz:-262, tx:0, ty:12, tz:-380, name:'Z-ant-5gate.png' })
}
