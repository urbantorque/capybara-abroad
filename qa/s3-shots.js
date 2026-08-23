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
  // ---- VENICE
  await cam({ biome:'venice', warm:120, hold:1, px:-4, py:1.6, pz:13, name:'T3-ven-arrival.png' })
  await cam({ biome:'venice', warm:60, hold:1, px:-4, py:1.6, pz:-30, name:'T3-ven-piazza.png' })
  await cam({ biome:'venice', warm:60, hold:1, px:-12, py:1.6, pz:-30, cx:-4, cy:6, cz:-24, tx:-24, ty:4, tz:-34, name:'T3-ven-arcade.png' })
  await cam({ biome:'venice', warm:60, hold:1, px:-20, py:1.6, pz:-31, name:'T3-ven-sotoportego.png' })
  await cam({ biome:'venice', warm:60, hold:1, px:-52, py:1.6, pz:-26, name:'T3-ven-calli.png' })
  await cam({ biome:'venice', warm:60, hold:1, px:-104, py:2, pz:-14, name:'T3-ven-canal.png' })
  await cam({ biome:'venice', warm:60, hold:1, px:-4, py:1.6, pz:-52, cx:-4, cy:10, cz:-30, tx:-4, ty:6, tz:-66, name:'T3-ven-basilica.png' })
  // ---- KOWLOON
  await cam({ biome:'kowloon', warm:120, hold:1, px:0, py:1.4, pz:34, name:'T3-hk-arrival.png' })
  await cam({ biome:'kowloon', warm:60, hold:1, px:0, py:1.4, pz:0, name:'T3-hk-street.png' })
  await cam({ biome:'kowloon', warm:60, hold:1, px:-6, py:1.4, pz:0, cx:6, cy:6, cz:6, tx:-14, ty:14, tz:-4, name:'T3-hk-scaffold.png' })
  await cam({ biome:'kowloon', warm:60, hold:1, px:0, py:1.4, pz:20, cx:0, cy:5, cz:34, tx:20, ty:3, tz:16, name:'T3-hk-lane.png' })
  await cam({ biome:'kowloon', warm:60, hold:1, px:29, py:1.4, pz:18, name:'T3-hk-market.png' })
  await cam({ biome:'kowloon', warm:60, hold:1, px:0, py:1.4, pz:-55, name:'T3-hk-pier.png' })
  await cam({ biome:'kowloon', warm:60, hold:1, px:-10.5, py:35, pz:0, cx:-4, cy:42, cz:20, tx:-12, ty:34, tz:-6, name:'T3-hk-roof.png' })
  // ---- DRIFT
  await cam({ biome:'drift', warm:120, hold:1, px:2, py:31.6, pz:42, name:'T3-dri-arrival.png' })
  await cam({ biome:'drift', warm:60, hold:1, px:0, py:31, pz:30, cx:30, cy:44, cz:60, tx:-20, ty:34, tz:-10, name:'T3-dri-shelf.png' })
  await cam({ biome:'drift', warm:60, hold:1, px:-38, py:42.5, pz:-47, name:'T3-dri-anvil.png' })
  await cam({ biome:'drift', warm:60, hold:1, px:-38, py:81, pz:-114, name:'T3-dri-orchard.png' })
  await cam({ biome:'drift', warm:60, hold:1, px:3, py:85, pz:-103, cx:20, cy:96, cz:-88, tx:30, ty:74, tz:-140, name:'T3-dri-gap.png' })
  await cam({ biome:'drift', warm:60, hold:1, px:36, py:109, pz:-184, name:'T3-dri-crown.png' })
}
