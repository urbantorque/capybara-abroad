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
  await cam({ biome:'sahara', warm:200, hold:1, px:0, py:1.4, pz:8,  cx:6, cy:11, cz:34, tx:-6, ty:3, tz:2, name:'FIN8-sah-square.png' })
  await cam({ biome:'sahara', warm:120, hold:1, px:70, py:1.4, pz:14, cx:48, cy:8, cz:14, tx:86, ty:7, tz:14, name:'FIN8-sah-gate.png' })
  await cam({ biome:'sahara', warm:120, hold:1, px:-40, py:1.4, pz:10, cx:-16, cy:16, cz:38, tx:-56, ty:16, tz:2, name:'FIN8-sah-kout.png' })
  await cam({ biome:'sahara', warm:120, hold:1, px:110, py:1.4, pz:20, cx:96, cy:9, cz:30, tx:124, ty:2, tz:12, name:'FIN8-sah-palm.png' })
  await cam({ biome:'sahara', warm:200, hold:1, px:182, py:6, pz:34, cx:182, cy:13, cz:46, tx:184, ty:3, tz:16, name:'FIN8-sah-camp.png' })
  await cam({ biome:'sahara', warm:120, hold:1, px:250, py:26, pz:10, cx:206, cy:32, cz:56, tx:284, ty:26, tz:6, name:'FIN8-sah-dune.png' })
  await cam({ biome:'sahara', warm:120, hold:1, px:296, py:14, pz:10, cx:320, cy:34, cz:44, tx:272, ty:22, tz:0, name:'FIN8-sah-lee.png' })
  await cam({ biome:'sahara', warm:120, hold:1, px:-24, py:1.4, pz:-38, cx:-24, cy:3.4, cz:-26, tx:-24, ty:2.4, tz:-52, name:'FIN8-sah-alley.png' })
}
