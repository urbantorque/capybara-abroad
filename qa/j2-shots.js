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
  await cam({ biome:'antarctic', api:'antarctic', px:0, pz:52, warm:240, name:'J-ant-spawn.png' })
  await cam({ biome:'antarctic', api:'antarctic', px:-15, pz:58, warm:200, name:'J-ant-huts.png' })
  await cam({ biome:'antarctic', api:'antarctic', px:24, pz:92, warm:220, name:'J-ant-colony.png' })
  await cam({ biome:'antarctic', api:'antarctic', px:114, pz:16, warm:220, name:'J-ant-bones.png' })
  await cam({ biome:'antarctic', api:'antarctic', px:-92, pz:-110, warm:220, name:'J-ant-glacier.png' })
  await cam({ biome:'antarctic', api:'antarctic', px:0, pz:36, warm:200, name:'J-ant-jetty.png' })
}
