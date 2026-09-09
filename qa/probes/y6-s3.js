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
  await cam({ biome:'rio', warm:300, hold:1, px:-36, py:0, pz:-30, cx:-36, cy:16, cz:0, tx:-40, ty:0, tz:-40, name:'Z6-break.png' })
  await cam({ biome:'rio', warm:60, hold:1, px:-36, py:0, pz:-24, cx:-30, cy:3.5, cz:-14, tx:-38, ty:1, tz:-34, name:'Z6-break-low.png' })
  await cam({ biome:'rio', warm:120, hold:1, px:0, py:1.4, pz:-2, cx:0, cy:34, cz:60, tx:0, ty:0, tz:-20, name:'Z6-wide.png' })
  await cam({ biome:'rio', warm:120, hold:1, px:0, py:1.4, pz:6, cx:0, cy:12, cz:-14, tx:0, ty:8, tz:22, name:'Z6-frontage.png' })
  await cam({ biome:'rio', warm:800, hold:1, px:0, py:1.4, pz:46, cx:-24, cy:14, cz:62, tx:6, ty:3, tz:44, name:'Z6-avenue.png' })
  await cam({ biome:'rio', warm:60, hold:1, px:-20, py:1.4, pz:-8, name:'Z6-beach.png' })
  await cam({ biome:'rio', warm:60, hold:1, px:-58, py:1.4, pz:-16, cx:-58, cy:14, cz:6, tx:-62, ty:2, tz:-30, name:'Z6-arpoador.png' })
}
