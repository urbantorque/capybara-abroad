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
  await cam({ biome:'sahara', warm:150, hold:1, px:0, py:1.4, pz:8,  cx:6, cy:11, cz:34, tx:-6, ty:3, tz:2, name:'Z8-sah-square.png' })
  await cam({ biome:'sahara', warm:120, hold:1, px:-40, py:1.4, pz:10, cx:-20, cy:16, cz:34, tx:-52, ty:16, tz:4, name:'Z8-sah-koutoubia.png' })
  await cam({ biome:'sahara', warm:120, hold:1, px:-24, py:1.4, pz:-38, cx:-24, cy:9, cz:-24, tx:-24, ty:2, tz:-50, name:'Z8-sah-souk.png' })
  await cam({ biome:'sahara', warm:120, hold:1, px:70, py:1.4, pz:14, cx:52, cy:8, cz:14, tx:86, ty:6, tz:14, name:'Z8-sah-gate.png' })
  await cam({ biome:'sahara', warm:120, hold:1, px:110, py:1.4, pz:14, cx:96, cy:9, cz:26, tx:124, ty:3, tz:8, name:'Z8-sah-palm.png' })
  await cam({ biome:'sahara', warm:120, hold:1, px:182, py:6, pz:34, cx:182, cy:14, cz:48, tx:184, ty:3, tz:16, name:'Z8-sah-camp.png' })
  await cam({ biome:'sahara', warm:120, hold:1, px:250, py:26, pz:10, cx:210, cy:34, cz:52, tx:280, ty:26, tz:6, name:'Z8-sah-dune.png' })
  await cam({ biome:'drift', warm:150, hold:1, px:2, py:31.6, pz:42, cx:16, cy:42, cz:62, tx:-4, ty:30, tz:26, name:'Z9-dri-shelf.png' })
  await cam({ biome:'drift', warm:120, hold:1, px:28, py:30.2, pz:34, cx:40, cy:38, cz:46, tx:10, ty:28, tz:30, name:'Z9-dri-jetty.png' })
  await cam({ biome:'drift', warm:120, hold:1, px:-38, py:80.2, pz:-114, cx:-20, cy:92, cz:-92, tx:-44, ty:80, tz:-120, name:'Z9-dri-orchard.png' })
  await cam({ biome:'drift', warm:120, hold:1, px:3, py:84.2, pz:-103, cx:-14, cy:96, cz:-84, tx:20, ty:78, tz:-124, name:'Z9-dri-arch.png' })
  await cam({ biome:'drift', warm:120, hold:1, px:36, py:108.2, pz:-178, cx:44, cy:120, cz:-160, tx:34, ty:110, tz:-192, name:'Z9-dri-crown.png' })
  await cam({ biome:'drift', warm:120, hold:1, px:-38, py:41.6, pz:-47, cx:-14, cy:60, cz:-14, tx:-56, ty:60, tz:-64, name:'Z9-dri-column.png' })
}
