async page => {
  await page.reload()
  await page.waitForTimeout(6000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const cam = async (o) => {
    await page.evaluate(async (q) => {
      const g = window.__capy, THREE = g.THREE
      if (g.biome.current !== q.biome) { g.biome.switchTo(q.biome) }
      const api = g[q.api]
      const b = g.capy.body
      const ter = api.terrainHeight
      b.position.set(q.px, ter(q.px,q.pz)+0.5, q.pz); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i=0;i<(q.warm||160);i++) {
        g.tick(1/60, false)
        if (!q.free) { b.position.set(q.px, ter(q.px,q.pz)+0.5, q.pz); b.velocity.set(0,0,0) }
      }
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280/760; g.camera.fov = q.fov||50; g.camera.far = 4000
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
  await cam({ biome:'cave', api:'cave', px:0, pz:62, warm:240, name:'J-cav-spawn.png' })
  await cam({ biome:'cave', api:'cave', px:0, pz:20, warm:200, name:'J-cav-entrance.png' })
  await cam({ biome:'cave', api:'cave', px:8, pz:-10, warm:200, name:'J-cav-hand.png' })
  await cam({ biome:'cave', api:'cave', px:4, pz:-48, warm:260, name:'J-cav-doline.png' })
  await cam({ biome:'cave', api:'cave', px:0, pz:-92, warm:200, name:'J-cav-wall.png' })
  await cam({ biome:'cave', api:'cave', px:-26, pz:-126, warm:220, name:'J-cav-roost.png' })
  await cam({ biome:'cave', api:'cave', px:0, pz:-160, warm:220, name:'J-cav-slot.png' })
}
