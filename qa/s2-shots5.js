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
  await cam({ biome:'cali', warm:200, px:-22, py:1, pz:52, cx:-22, cy:22, cz:82, tx:-22, ty:1, tz:50, name:'S5-floor.png' })
  await cam({ biome:'cali', warm:120, px:-22, py:1, pz:52, cx:-12, cy:8, cz:64, tx:-24, ty:1.4, tz:50, name:'S5-floor2.png' })
  await cam({ biome:'cali', warm:60, px:0, py:1, pz:40, cx:-24, cy:10, cz:47, tx:24, ty:3, tz:38, name:'S5-street.png' })
  await cam({ biome:'cali', warm:60, px:-20, py:1, pz:-16, cx:-40, cy:10, cz:-4, tx:0, ty:3, tz:-18, name:'S5-gato.png' })
  await cam({ biome:'cali', warm:60, px:-6, py:1, pz:8, cx:-30, cy:8, cz:16, tx:20, ty:0, tz:-2, name:'S5-river.png' })
  await cam({ biome:'cali', warm:60, px:-84, py:18.5, pz:-46, cx:-72, cy:24, cz:-30, tx:-100, ty:14, tz:-58, name:'S5-mirador.png' })
}
