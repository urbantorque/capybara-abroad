async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const cam = async (o) => {
    await page.evaluate(async (q) => {
      const g = window.__capy, THREE = g.THREE
      if (g.biome.current !== q.biome) { g.biome.switchTo(q.biome) }
      const b = g.capy.body
      b.position.set(q.px, q.py, q.pz); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i=0;i<q.warm;i++) g.tick(1/60, false)
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280/760
      g.camera.fov = q.fov || 50
      g.camera.far = q.far || 3000
      g.camera.updateProjectionMatrix()
      g.camera.position.set(q.cx, q.cy, q.cz)
      g.camera.lookAt(new THREE.Vector3(q.tx, q.ty, q.tz))
      g.camera.updateMatrixWorld(true)
      g.renderer.render(g.scene, g.camera)
      const d = g.renderer.domElement.toDataURL('image/png')
      await fetch('/shot?name=' + q.name, { method:'POST', body: d.split(',')[1] })
    }, o)
  }
  await cam({ biome:'kyoto', warm:150, px:0, py:1.4, pz:52, cx:-26, cy:9, cz:56, tx:22, ty:3, tz:50, name:'S4-gion.png' })
  await cam({ biome:'kyoto', warm:60, px:-15, py:1, pz:32, cx:-15, cy:8, cz:38, tx:-15, ty:3, tz:22, name:'S4-bell.png' })
  await cam({ biome:'kyoto', warm:120, px:-10, py:1, pz:52, cx:-14, cy:3.4, cz:57.5, tx:16, ty:3.2, tz:52, name:'S4-lanterns.png' })
  await cam({ biome:'kyoto', warm:60, px:4, py:2, pz:140, cx:8, cy:12, cz:150, tx:4, ty:1, tz:124, name:'S4-bridge.png' })
  await cam({ biome:'kyoto', warm:60, px:129, py:1, pz:150, cx:140, cy:12, cz:166, tx:120, ty:0, tz:146, name:'S4-mill.png' })
  await cam({ biome:'kyoto', warm:60, px:30, py:1, pz:-12, cx:52, cy:14, cz:8, tx:26, ty:3, tz:-14, name:'S4-pond.png' })
}
