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
  await cam({ biome:'rio', warm:1000, hold:1, px:-36, py:0, pz:-30, cx:-30, cy:9, cz:-6, tx:-40, ty:0, tz:-44, name:'Z7-break.png' })
  await cam({ biome:'rio', warm:180, hold:1, px:-36, py:0, pz:-30, cx:-30, cy:9, cz:-6, tx:-40, ty:0, tz:-44, name:'Z7-break2.png' })
  await cam({ biome:'rio', warm:120, hold:1, px:-16, py:1.4, pz:-9, cx:-14, cy:5.5, cz:0, tx:-18, ty:1, tz:-14, name:'Z7-volei.png' })
  await cam({ biome:'rio', warm:120, hold:1, px:-8, py:1.4, pz:-11, cx:-8, cy:6, cz:-16, tx:-8, ty:2, tz:-5, name:'Z7-kiosk.png' })
  await cam({ biome:'rio', warm:90, hold:1, px:58, py:8, pz:-8, cx:20, cy:38, cz:34, tx:96, ty:30, tz:-54, name:'Z7-sugarloaf.png' })
  await cam({ biome:'rio', warm:90, hold:1, px:0, py:1.4, pz:0, name:'Z7-spawn.png' })
  await cam({ biome:'rio', warm:90, hold:1, px:0, py:1.4, pz:-2, cx:0, cy:40, cz:70, tx:0, ty:0, tz:-24, name:'Z7-wide.png' })
}
