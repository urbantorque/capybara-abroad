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
      await fetch('/shot?name=' + q.name + '&sun=' + (g.goreme ? g.goreme.sunUp().toFixed(2) : 0), { method:'POST', body: d.split(',')[1] })
    }, o)
  }
  await cam({ biome:'goreme', warm:4300, hold:1, px:0, py:2, pz:-40, cx:-42, cy:80, cz:10, tx:96, ty:56, tz:-50, name:'ZF-gor-rim.png' })
  await cam({ biome:'goreme', warm:900, hold:1, px:0, py:2, pz:-40, cx:-30, cy:64, cz:-16, tx:100, ty:54, tz:-46, name:'ZF-gor-sun.png' })
  await cam({ biome:'goreme', warm:60, hold:1, px:0, py:7.4, pz:34, cx:7, cy:11, cz:48, tx:-7, ty:7, tz:37, name:'ZF-gor-plaza.png' })
  await cam({ biome:'goreme', warm:60, hold:1, px:0, py:2, pz:-40, cx:12, cy:13, cz:-12, tx:-4, ty:5, tz:-56, name:'ZF-gor-valley.png' })
  await cam({ biome:'palawan', warm:180, hold:1, px:-8, py:-4.2, pz:-118, cx:-11, cy:-3.5, cz:-124, tx:2.5, ty:14, tz:-115, name:'ZF-pal-cath.png' })
  await cam({ biome:'palawan', warm:120, hold:1, px:-13, py:-4.6, pz:2, cx:-6, cy:-2.9, cz:13, tx:-15, ty:-5.0, tz:-8, name:'ZF-pal-reef.png' })
  await cam({ biome:'palawan', warm:600, hold:1, px:8, py:-1.0, pz:-10, cx:18, cy:4.5, cz:2, tx:6, ty:2, tz:-20, name:'ZF-pal-terns.png' })
}
