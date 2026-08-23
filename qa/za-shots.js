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
  await cam({ biome:'palawan', warm:150, hold:1, px:0, py:2.2, pz:46, cx:0, cy:9, cz:62, tx:0, ty:0, tz:10, name:'ZA-pal-spawn.png' })
  await cam({ biome:'palawan', warm:120, hold:1, px:-13, py:-5.2, pz:4, cx:-13, cy:-3.6, cz:16, tx:-13, ty:-6, tz:-6, name:'ZA-pal-reef.png' })
  await cam({ biome:'palawan', warm:120, hold:1, px:8, py:-6.4, pz:-18, cx:16, cy:-4, cz:-8, tx:6, ty:-7, tz:-22, name:'ZA-pal-bait.png' })
  await cam({ biome:'palawan', warm:120, hold:1, px:21, py:-10, pz:-21, cx:32, cy:-6, cz:-12, tx:18, ty:-11, tz:-24, name:'ZA-pal-wreck.png' })
  await cam({ biome:'palawan', warm:120, hold:1, px:0, py:-3, pz:-70, cx:0, cy:-1, cz:-48, tx:0, ty:6, tz:-84, name:'ZA-pal-lagoon.png' })
  await cam({ biome:'palawan', warm:120, hold:1, px:2, py:-3, pz:-118, cx:2, cy:-2, cz:-104, tx:2.5, ty:12, tz:-116, name:'ZA-pal-cath.png' })
  await cam({ biome:'palawan', warm:120, hold:1, px:6, py:1.4, pz:20, cx:14, cy:6, cz:34, tx:0, ty:0, tz:0, name:'ZA-pal-jetty.png' })
  await cam({ biome:'goreme', warm:150, hold:1, px:0, py:7.4, pz:34, cx:0, cy:14, cz:50, tx:0, ty:6, tz:6, name:'ZA-gor-plaza.png' })
  await cam({ biome:'goreme', warm:600, hold:1, px:0, py:4.6, pz:4, cx:-4, cy:12, cz:32, tx:2, ty:5, tz:2, name:'ZA-gor-field.png' })
  await cam({ biome:'goreme', warm:400, hold:1, px:0, py:2, pz:-40, cx:14, cy:22, cz:-4, tx:-4, ty:6, tz:-62, name:'ZA-gor-valley.png' })
  await cam({ biome:'goreme', warm:200, hold:1, px:-66, py:2, pz:-42, cx:-40, cy:20, cz:-42, tx:-80, ty:20, tz:-42, name:'ZA-gor-cliff.png' })
  await cam({ biome:'goreme', warm:900, hold:1, px:0, py:2, pz:-40, cx:-40, cy:120, cz:20, tx:60, ty:60, tz:-60, name:'ZA-gor-air.png' })
}
