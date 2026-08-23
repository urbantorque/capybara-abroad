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
      for (let i=0;i<q.warm;i++) g.tick(1/60, false)
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
  await cam({ biome:'quay', warm:120, px:4, py:1, pz:26, cx:6, cy:14, cz:44, tx:6, ty:1, tz:-4, name:'S3-terminal.png' })
  await cam({ biome:'quay', warm:60, px:20, py:1, pz:-40, cx:20, cy:9, cz:-8, tx:20, ty:0, tz:-60, name:'S3-buoys.png' })
  await cam({ biome:'quay', warm:60, px:20, py:1, pz:-30, cx:24, cy:22, cz:14, tx:16, ty:12, tz:-70, name:'S3-bridge.png' })
  await cam({ biome:'quay', warm:60, px:-30, py:1, pz:-160, cx:-24, cy:16, cz:-140, tx:-76, ty:8, tz:-196, name:'S3-brad.png' })
  await cam({ biome:'quay', warm:60, px:118, py:1.2, pz:-540, cx:120, cy:20, cz:-500, tx:118, ty:2, tz:-590, name:'S3-manly.png' })
  await cam({ biome:'quay', warm:60, px:40, py:1, pz:-100, cx:44, cy:12, cz:-70, tx:44, ty:2, tz:-140, name:'S3-fresh.png' })
}
