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
      } else { g.tick(1/60, true) }
      const d = g.renderer.domElement.toDataURL('image/png')
      await fetch('/shot?name=' + q.name, { method:'POST', body: d.split(',')[1] })
    }, o)
  }
  await cam({ biome:'iceland', warm:200, hold:1, px:-16, py:20, pz:-160, cx:0, cy:40, cz:-100, tx:-20, ty:20, tz:-180, name:'Z8-tongue.png' })
  await cam({ biome:'iceland', warm:60, hold:1, px:-16, py:8, pz:-100, name:'Z8-glacier.png' })
  await cam({ biome:'iceland', warm:400, hold:1, px:-40, py:0.4, pz:-10, name:'Z8-spring.png' })
  await cam({ biome:'iceland', warm:120, hold:1, px:26, py:1.6, pz:120, cx:26, cy:26, cz:160, tx:20, ty:0, tz:115, name:'Z8-harbour.png' })
  await cam({ biome:'iceland', warm:120, hold:1, px:26, py:1.6, pz:134, cx:26, cy:8, cz:118, tx:26, ty:1, tz:150, name:'Z8-pier.png' })
  await cam({ biome:'iceland', warm:120, hold:1, px:70, py:20, pz:118, name:'Z8-cliff.png' })
  await cam({ biome:'iceland', warm:120, hold:1, px:-16, py:9, pz:76, cx:-16, cy:16, cz:96, tx:-16, ty:22, tz:62, name:'Z8-church.png' })
  await cam({ biome:'iceland', warm:120, hold:1, px:0, py:1.4, pz:99, name:'Z8-spawn.png' })
  await cam({ biome:'iceland', warm:120, hold:1, px:34, py:2, pz:-140, name:'Z8-moraine.png' })
  await cam({ biome:'iceland', warm:120, hold:1, px:10, py:1, pz:8, name:'Z8-geysir.png' })
}
