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
  await cam({ biome:'rio', warm:120, hold:1, px:-8, py:1.4, pz:-11, cx:-8, cy:6, cz:-16, tx:-8, ty:2, tz:-5, name:'Y6-rio-kiosk.png' })
  await cam({ biome:'rio', warm:120, hold:1, px:-20, py:1.4, pz:80, cx:-20, cy:9, cz:74, tx:-20, ty:6, tz:100, name:'Y6-rio-selaron2.png' })
  await cam({ biome:'rio', warm:900, hold:1, px:0, py:1.4, pz:46, cx:-20, cy:12, cz:60, tx:10, ty:3, tz:44, name:'Y6-rio-bateria.png' })
  await cam({ biome:'rio', warm:300, hold:1, px:-36, py:0, pz:-30, cx:-36, cy:16, cz:0, tx:-40, ty:0, tz:-40, name:'Y6-rio-break.png' })
  await cam({ biome:'iceland', warm:120, hold:1, px:26, py:1.6, pz:120, cx:26, cy:26, cz:160, tx:20, ty:0, tz:115, name:'Y7-ice-harbour.png' })
  await cam({ biome:'iceland', warm:120, hold:1, px:0, py:1.4, pz:99, cx:-10, cy:30, cz:135, tx:-10, ty:2, tz:90, name:'Y7-ice-town.png' })
  await cam({ biome:'iceland', warm:900, hold:1, px:26, py:1.6, pz:136, cx:26, cy:10, cz:120, tx:8, ty:2, tz:164, name:'Y7-ice-whale.png' })
  await cam({ biome:'iceland', warm:120, hold:1, px:-16, py:20, pz:-160, cx:0, cy:40, cz:-100, tx:-20, ty:20, tz:-180, name:'Y7-ice-tongue.png' })
}
