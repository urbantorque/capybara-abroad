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
      // the biome may key per-frame geometry off the CAMERA (reflections do),
      // so give it one tick against the shot camera before the render
      if (g[q.biome] && g[q.biome].update) g[q.biome].update(0.001)
      g.camera.updateMatrixWorld(true)
      g.renderer.render(g.scene, g.camera)
      const d = g.renderer.domElement.toDataURL('image/png')
      await fetch('/shot?name=' + q.name, { method:'POST', body: d.split(',')[1] })
    }, o)
  }
  await cam({ biome:'kyoto', warm:150, px:24, py:1, pz:176, cx:24, cy:8, cz:196, tx:24, ty:2, tz:168, name:'C4-ujist.png' })
  await cam({ biome:'kyoto', warm:40, px:112, py:1, pz:182, cx:96, cy:12, cz:196, tx:126, ty:4, tz:186, name:'C4-pick.png' })
  await cam({ biome:'kyoto', warm:40, px:30, py:1, pz:-12, cx:52, cy:9, cz:8, tx:26, ty:3, tz:-14, name:'C4-refl.png' })
  await cam({ biome:'kyoto', warm:40, px:-32, py:1, pz:-108, cx:-22, cy:34, cz:-92, tx:-36, ty:28, tz:-114, name:'C4-summit.png' })
  await cam({ biome:'kyoto', warm:40, px:-15, py:1, pz:32, cx:-4, cy:9, cz:42, tx:-18, ty:4, tz:22, name:'C4-bell.png' })
}
