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
      if (q.night && g.cali) { /* the night comes up with the ride */ }
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280/760
      g.camera.fov = q.fov || 50
      g.camera.far = q.far || 3000
      g.camera.updateProjectionMatrix()
      g.camera.position.set(q.cx, q.cy, q.cz)
      g.camera.lookAt(new THREE.Vector3(q.tx, q.ty, q.tz))
      g.camera.updateMatrixWorld(true)
      if (g[q.biome] && g[q.biome].update) g[q.biome].update(0.001)
      g.camera.updateMatrixWorld(true)
      g.renderer.render(g.scene, g.camera)
      const d = g.renderer.domElement.toDataURL('image/png')
      await fetch('/shot?name=' + q.name, { method:'POST', body: d.split(',')[1] })
    }, o)
  }
  await cam({ biome:'cali', warm:150, px:-84, py:18.2, pz:-46, cx:-70, cy:27, cz:-58, tx:-90, ty:18, tz:-42, fov:52, name:'C5-mir.png' })
  await cam({ biome:'cali', warm:40, px:-30, py:1, pz:14, cx:2, cy:16, cz:-34, tx:-40, ty:1, tz:6, name:'C5-paseo.png' })
  await cam({ biome:'cali', warm:40, px:-22, py:1.4, pz:52, cx:-22, cy:6.5, cz:70, tx:-22, ty:2, tz:48, fov:46, name:'C5-ring.png' })
}
