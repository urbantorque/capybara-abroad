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
      b.position.set(q.px, q.py, q.pz); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i=0;i<(q.warm||60);i++) { g.tick(1/60, false); if (q.hold) { b.position.set(q.px,q.py,q.pz); b.velocity.set(0,0,0) } }
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280/760
      g.camera.fov = q.fov || 50
      g.camera.far = q.far || 3000
      g.camera.updateProjectionMatrix()
      if (q.cx !== undefined) {
        g.camera.position.set(q.cx, q.cy, q.cz)
        g.camera.lookAt(new THREE.Vector3(q.tx, q.ty, q.tz))
        g.camera.updateMatrixWorld(true)
        g.renderer.render(g.scene, g.camera)
      } else {
        g.tick(1/60, true)
      }
      const d = g.renderer.domElement.toDataURL('image/png')
      await fetch('/shot?name=' + q.name, { method:'POST', body: d.split(',')[1] })
    }, o)
  }
  await cam({ biome:'rio', warm:200, hold:1, px:0, py:1.4, pz:0, name:'Y6-rio-spawn.png' })
  await cam({ biome:'rio', warm:90, hold:1, px:-20, py:1.4, pz:-8, name:'Y6-rio-beach.png' })
  await cam({ biome:'rio', warm:90, hold:1, px:-58, py:1.4, pz:-16, cx:-58, cy:14, cz:6, tx:-62, ty:2, tz:-30, name:'Y6-rio-arpoador.png' })
  await cam({ biome:'rio', warm:600, hold:1, px:-40, py:1.4, pz:46, name:'Y6-rio-avenue.png' })
  await cam({ biome:'rio', warm:90, hold:1, px:-20, py:1.4, pz:88, name:'Y6-rio-selaron.png' })
  await cam({ biome:'rio', warm:90, hold:1, px:-28, py:1.4, pz:70, cx:-28, cy:14, cz:52, tx:-28, ty:12, tz:78, name:'Y6-rio-lapa.png' })
  await cam({ biome:'rio', warm:90, hold:1, px:58, py:8, pz:-8, cx:40, cy:26, cz:20, tx:90, ty:36, tz:-50, name:'Y6-rio-sugarloaf.png' })
  await cam({ biome:'rio', warm:90, hold:1, px:0, py:1.4, pz:-2, cx:0, cy:34, cz:60, tx:0, ty:0, tz:-20, name:'Y6-rio-wide.png' })
  await cam({ biome:'iceland', warm:200, hold:1, px:0, py:1.4, pz:99, name:'Y7-ice-spawn.png' })
  await cam({ biome:'iceland', warm:90, hold:1, px:-16, py:9, pz:76, cx:-16, cy:16, cz:96, tx:-16, ty:22, tz:62, name:'Y7-ice-church.png' })
  await cam({ biome:'iceland', warm:90, hold:1, px:26, py:1.4, pz:132, name:'Y7-ice-pier.png' })
  await cam({ biome:'iceland', warm:90, hold:1, px:70, py:20, pz:118, name:'Y7-ice-cliff.png' })
  await cam({ biome:'iceland', warm:90, hold:1, px:10, py:1, pz:8, name:'Y7-ice-geysir.png' })
  await cam({ biome:'iceland', warm:90, hold:1, px:-40, py:0.4, pz:-10, name:'Y7-ice-spring.png' })
  await cam({ biome:'iceland', warm:90, hold:1, px:-16, py:8, pz:-100, name:'Y7-ice-glacier.png' })
  await cam({ biome:'iceland', warm:90, hold:1, px:0, py:1, pz:-40, cx:0, cy:16, cz:-20, tx:-10, ty:12, tz:-100, name:'Y7-ice-lagoon.png' })
  await cam({ biome:'iceland', warm:90, hold:1, px:34, py:2, pz:-140, name:'Y7-ice-moraine.png' })
}
