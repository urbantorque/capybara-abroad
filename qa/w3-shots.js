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
      if (q.tide !== undefined && g.venice) { /* fast-forward tide by ticking */ }
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
  await cam({ biome:'venice', warm:180, hold:1, px:-4, py:1.6, pz:13, name:'W0-ven-arrival.png' })
  await cam({ biome:'venice', warm:60, hold:1, px:-4, py:1.6, pz:-30, name:'W0-ven-piazza.png' })
  await cam({ biome:'venice', warm:60, hold:1, px:-4, py:1.6, pz:-52, cx:-4, cy:10, cz:-30, tx:-4, ty:6, tz:-66, name:'W0-ven-basilica.png' })
  await cam({ biome:'venice', warm:60, hold:1, px:-12, py:1.6, pz:-30, cx:-4, cy:6, cz:-24, tx:-24, ty:4, tz:-34, name:'W0-ven-arcade.png' })
  await cam({ biome:'venice', warm:60, hold:1, px:-52, py:1.6, pz:-26, name:'W0-ven-calli.png' })
  await cam({ biome:'venice', warm:60, hold:1, px:-104, py:2, pz:-14, name:'W0-ven-canal.png' })
  await cam({ biome:'venice', warm:60, hold:1, px:8, py:2, pz:-10, cx:24, cy:12, cz:6, tx:0, ty:8, tz:-24, name:'W0-ven-palace.png' })
  await cam({ biome:'kowloon', warm:180, hold:1, px:0, py:1.4, pz:34, name:'W0-hk-arrival.png' })
  await cam({ biome:'kowloon', warm:60, hold:1, px:0, py:1.4, pz:0, name:'W0-hk-street.png' })
  await cam({ biome:'kowloon', warm:60, hold:1, px:0, py:1.4, pz:36, cx:0, cy:5, cz:50, tx:-3.4, ty:4, tz:30, name:'W0-hk-lion.png' })
  await cam({ biome:'kowloon', warm:60, hold:1, px:29, py:1.4, pz:18, name:'W0-hk-market.png' })
  await cam({ biome:'kowloon', warm:60, hold:1, px:8, py:1.4, pz:-24, cx:0, cy:4, cz:-14, tx:10, ty:2, tz:-26, name:'W0-hk-dpd.png' })
  await cam({ biome:'kowloon', warm:60, hold:1, px:0, py:1.4, pz:-55, name:'W0-hk-pier.png' })
  await cam({ biome:'kowloon', warm:60, hold:1, px:-10.5, py:35, pz:0, cx:-4, cy:42, cz:20, tx:-12, ty:34, tz:-6, name:'W0-hk-roof.png' })
}
