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
      for (let i=0;i<(q.warm||60);i++) { g.tick(1/60, false); b.position.set(q.px,q.py,q.pz); b.velocity.set(0,0,0) }
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
  await cam({ biome:'venice', warm:150, px:-4, py:1.6, pz:13, cx:-4, cy:7, cz:24, tx:-4, ty:3, tz:-6, name:'U-ven-arrival.png' })
  await cam({ biome:'venice', warm:60, px:-4, py:1.6, pz:-24, cx:-4, cy:9, cz:-14, tx:-4, ty:5, tz:-60, name:'U-ven-piazza.png' })
  await cam({ biome:'venice', warm:60, px:-10, py:1.6, pz:-26, cx:-2, cy:4.5, cz:-26, tx:-18, ty:3.5, tz:-28, name:'U-ven-arcade.png' })
  await cam({ biome:'venice', warm:60, px:-12, py:1.6, pz:-31, cx:-2, cy:4, cz:-31, tx:-30, ty:2.5, tz:-31, name:'U-ven-soto.png' })
  await cam({ biome:'venice', warm:60, px:-52, py:1.9, pz:-26, cx:-42, cy:8, cz:-18, tx:-62, ty:2, tz:-32, name:'U-ven-calli.png' })
  await cam({ biome:'venice', warm:60, px:-100, py:2, pz:-6, cx:-92, cy:14, cz:16, tx:-118, ty:2, tz:-30, name:'U-ven-canal.png' })
  await cam({ biome:'venice', warm:60, px:-4, py:1.6, pz:-52, cx:-4, cy:8, cz:-40, tx:-4, ty:8, tz:-64, name:'U-ven-basilica.png' })
  await cam({ biome:'venice', warm:60, px:8, py:1.6, pz:-4, cx:-6, cy:7, cz:-4, tx:16, ty:6, tz:-4, name:'U-ven-palace.png' })
  await cam({ biome:'kowloon', warm:150, px:0, py:1.4, pz:34, cx:0, cy:6, cz:48, tx:0, ty:5, tz:14, name:'U-hk-arrival.png' })
  await cam({ biome:'kowloon', warm:60, px:0, py:1.4, pz:6, cx:0, cy:6, cz:26, tx:0, ty:6, tz:-16, name:'U-hk-street.png' })
  await cam({ biome:'kowloon', warm:60, px:-6, py:1.4, pz:0, cx:8, cy:9, cz:8, tx:-12, ty:20, tz:-2, name:'U-hk-scaffold.png' })
  await cam({ biome:'kowloon', warm:60, px:0, py:1.4, pz:18, cx:-6, cy:5, cz:18, tx:34, ty:3, tz:18, name:'U-hk-lane.png' })
  await cam({ biome:'kowloon', warm:60, px:29, py:1.4, pz:18, cx:18, cy:7, cz:26, tx:34, ty:2, tz:14, name:'U-hk-market.png' })
  await cam({ biome:'kowloon', warm:60, px:0, py:1.4, pz:-52, cx:0, cy:7, cz:-38, tx:0, ty:2, tz:-90, name:'U-hk-pier.png' })
  await cam({ biome:'kowloon', warm:60, px:-10.5, py:35.4, pz:0, cx:2, cy:42, cz:16, tx:-14, ty:34, tz:-4, name:'U-hk-roof.png' })
  await cam({ biome:'drift', warm:150, px:2, py:31.6, pz:42, cx:2, cy:37, cz:56, tx:0, ty:31, tz:20, name:'U-dri-arrival.png' })
  await cam({ biome:'drift', warm:60, px:0, py:31, pz:24, cx:22, cy:44, cz:52, tx:-24, ty:33, tz:-16, name:'U-dri-shelf.png' })
  await cam({ biome:'drift', warm:60, px:-38, py:42.5, pz:-47, cx:-16, cy:52, cz:-28, tx:-58, ty:60, tz:-70, name:'U-dri-anvil.png' })
  await cam({ biome:'drift', warm:60, px:-38, py:81, pz:-114, cx:-20, cy:88, cz:-96, tx:-46, ty:80, tz:-124, name:'U-dri-orchard.png' })
  await cam({ biome:'drift', warm:60, px:3, py:85, pz:-103, cx:-8, cy:94, cz:-92, tx:38, ty:72, tz:-140, name:'U-dri-gap.png' })
  await cam({ biome:'drift', warm:60, px:36, py:109, pz:-176, cx:36, cy:116, cz:-162, tx:36, ty:110, tz:-196, name:'U-dri-crown.png' })
}
