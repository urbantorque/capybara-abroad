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
      g.camera.position.set(q.cx, q.cy, q.cz)
      g.camera.lookAt(new THREE.Vector3(q.tx, q.ty, q.tz))
      g.camera.updateMatrixWorld(true)
      g.renderer.render(g.scene, g.camera)
      const d = g.renderer.domElement.toDataURL('image/png')
      await fetch('/shot?name=' + q.name, { method:'POST', body: d.split(',')[1] })
    }, o)
  }
  await cam({ biome:'palawan', warm:180, hold:1, px:-8, py:-4.2, pz:-118, cx:-11, cy:-3.5, cz:-124, tx:2.5, ty:14, tz:-115, name:'ZE-pal-cath.png' })
  await cam({ biome:'palawan', warm:120, hold:1, px:-13, py:-4.6, pz:2, cx:-6, cy:-2.9, cz:13, tx:-15, ty:-5.0, tz:-8, name:'ZE-pal-reef.png' })
  await cam({ biome:'palawan', warm:120, hold:1, px:0, py:2.2, pz:46, cx:-4, cy:9, cz:58, tx:2, ty:1, tz:12, name:'ZE-pal-spawn.png' })
  await cam({ biome:'palawan', warm:520, hold:1, px:8, py:-6.0, pz:-16, cx:16, cy:1.5, cz:-6, tx:7, ty:-6, tz:-20, name:'ZE-pal-terns.png' })
  await cam({ biome:'palawan', warm:120, hold:1, px:0, py:-2.2, pz:-68, cx:9, cy:-1.2, cz:-54, tx:-3, ty:7, tz:-80, name:'ZE-pal-lagoon.png' })
  await cam({ biome:'goreme', warm:200, hold:1, px:0, py:7.4, pz:34, cx:6, cy:12, cz:50, tx:-6, ty:7, tz:36, name:'ZE-gor-plaza.png' })
  await cam({ biome:'goreme', warm:400, hold:1, px:0, py:2, pz:-40, cx:12, cy:14, cz:-10, tx:-4, ty:6, tz:-58, name:'ZE-gor-valley.png' })
  await cam({ biome:'goreme', warm:200, hold:1, px:-64, py:2, pz:-34, cx:-50, cy:8, cz:-26, tx:-74, ty:16, tz:-42, name:'ZE-gor-cliff.png' })
  await cam({ biome:'goreme', warm:1150, hold:1, px:0, py:2, pz:-40, cx:-46, cy:96, cz:16, tx:90, ty:56, tz:-52, name:'ZE-gor-dawn.png' })
  await cam({ biome:'goreme', warm:600, hold:1, px:0, py:4.6, pz:4, cx:-6, cy:10, cz:30, tx:4, ty:5, tz:2, name:'ZE-gor-field.png' })
}
