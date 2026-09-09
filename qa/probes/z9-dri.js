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
  await cam({ biome:'drift', warm:150, hold:1, px:2, py:31.6, pz:42, cx:16, cy:42, cz:62, tx:-4, ty:30, tz:26, name:'FIN9-dri-shelf.png' })
  await cam({ biome:'drift', warm:120, hold:1, px:-38, py:80.2, pz:-114, cx:-20, cy:90, cz:-94, tx:-44, ty:80, tz:-120, name:'FIN9-dri-orchard.png' })
  await cam({ biome:'drift', warm:120, hold:1, px:-30, py:80.2, pz:-110, cx:-30, cy:84, cz:-102, tx:-32, ty:82, tz:-118, name:'FIN9-dri-flies.png' })
  await cam({ biome:'drift', warm:120, hold:1, px:3, py:84.2, pz:-103, cx:-12, cy:94, cz:-86, tx:20, ty:78, tz:-124, name:'FIN9-dri-arch.png' })
  await cam({ biome:'drift', warm:120, hold:1, px:36, py:108.2, pz:-178, cx:44, cy:118, cz:-160, tx:34, ty:110, tz:-192, name:'FIN9-dri-crown.png' })
  await cam({ biome:'drift', warm:120, hold:1, px:-38, py:41.6, pz:-47, cx:-14, cy:58, cz:-14, tx:-56, ty:58, tz:-64, name:'FIN9-dri-column.png' })
  await cam({ biome:'drift', warm:120, hold:1, px:11, py:31.6, pz:35, cx:11, cy:34.5, cz:40, tx:11, ty:33.5, tz:28, name:'FIN9-dri-vane.png' })
}
