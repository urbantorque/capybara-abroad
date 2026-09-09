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
  // ---- CAVE
  await cam({ biome:'cave', warm:200, hold:1, px:0, py:4.5, pz:62, name:'B1-cav-spawn.png' })
  await cam({ biome:'cave', warm:120, hold:1, px:4, py:2.4, pz:44, name:'B1-cav-mouth.png' })
  await cam({ biome:'cave', warm:120, hold:1, px:6, py:-4.4, pz:20, name:'B1-cav-pass.png' })
  await cam({ biome:'cave', warm:120, hold:1, px:16, py:-4.0, pz:6, cx:34, cy:12, cz:22, tx:16, ty:8, tz:-4, name:'B1-cav-hand.png' })
  await cam({ biome:'cave', warm:200, hold:1, px:4, py:-2.0, pz:-30, cx:4, cy:12, cz:0, tx:4, ty:2, tz:-52, name:'B1-cav-doline.png' })
  await cam({ biome:'cave', warm:200, hold:1, px:4, py:-2.0, pz:-48, name:'B1-cav-dolin2.png' })
  await cam({ biome:'cave', warm:120, hold:1, px:0, py:-6.0, pz:-92, cx:0, cy:6, cz:-80, tx:0, ty:6, tz:-112, name:'B1-cav-wall.png' })
  await cam({ biome:'cave', warm:120, hold:1, px:-30, py:8.0, pz:-118, cx:-30, cy:14, cz:-104, tx:-30, ty:22, tz:-132, name:'B1-cav-roost.png' })
  await cam({ biome:'cave', warm:120, hold:1, px:22, py:8.0, pz:-132, name:'B1-cav-pearls.png' })
  await cam({ biome:'cave', warm:120, hold:1, px:0, py:11, pz:-160, cx:0, cy:16, cz:-146, tx:0, ty:10, tz:-172, name:'B1-cav-exit.png' })
  await cam({ biome:'cave', warm:120, hold:1, px:-20, py:-7.0, pz:0, name:'B1-cav-river.png' })
  // ---- ANTARCTIC
  await cam({ biome:'antarctic', warm:200, hold:1, px:0, py:7.1, pz:52, name:'B2-ant-spawn.png' })
  await cam({ biome:'antarctic', warm:120, hold:1, px:-17, py:0, pz:64, cx:-17, cy:12, cz:80, tx:-14, ty:2, tz:50, name:'B2-ant-huts.png' })
  await cam({ biome:'antarctic', warm:120, hold:1, px:24, py:0, pz:92, name:'B2-ant-colony.png' })
  await cam({ biome:'antarctic', warm:120, hold:1, px:0, py:1.2, pz:26, name:'B2-ant-jetty.png' })
  await cam({ biome:'antarctic', warm:120, hold:1, px:-108, py:0, pz:-110, cx:-70, cy:40, cz:-110, tx:-150, ty:20, tz:-110, name:'B2-ant-glacier.png' })
  await cam({ biome:'antarctic', warm:120, hold:1, px:114, py:0, pz:14, name:'B2-ant-bones.png' })
  await cam({ biome:'antarctic', warm:120, hold:1, px:74, py:0, pz:-390, cx:74, cy:14, cz:-370, tx:74, ty:6, tz:-420, name:'B2-ant-berg.png' })
  await cam({ biome:'antarctic', warm:120, hold:1, px:16, py:0, pz:-200, cx:16, cy:26, cz:-170, tx:10, ty:0, tz:-240, name:'B2-ant-pack.png' })
}
