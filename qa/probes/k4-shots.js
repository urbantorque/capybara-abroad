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
  await cam({ biome:'kyoto', warm:150, px:-14, py:14, pz:-80, cx:-2, cy:26, cz:-46, tx:-30, ty:24, tz:-104, name:'B4-torii.png' })
  await cam({ biome:'kyoto', warm:40, px:30, py:1, pz:-12, cx:56, cy:16, cz:14, tx:26, ty:4, tz:-14, name:'B4-pond.png' })
  await cam({ biome:'kyoto', warm:40, px:0, py:1.4, pz:52, cx:-30, cy:11, cz:60, tx:24, ty:4, tz:48, name:'B4-gion.png' })
  await cam({ biome:'kyoto', warm:40, px:24, py:1, pz:176, cx:-6, cy:22, cz:210, tx:40, ty:4, tz:170, name:'B4-uji.png' })
  await cam({ biome:'kyoto', warm:40, px:130, py:1, pz:176, cx:100, cy:32, cz:230, tx:140, ty:8, tz:180, name:'B4-terrace.png' })
  await cam({ biome:'kyoto', warm:40, px:-84, py:1, pz:-44, cx:-50, cy:20, cz:-14, tx:-90, ty:8, tz:-50, name:'B4-bamboo.png' })
  await cam({ biome:'cali', warm:150, px:-22, py:1.4, pz:52, cx:-40, cy:14, cz:74, tx:-16, ty:3, tz:48, name:'B5-floor.png' })
  await cam({ biome:'cali', warm:40, px:0, py:1.4, pz:40, cx:-34, cy:12, cz:56, tx:24, ty:4, tz:36, name:'B5-street.png' })
  await cam({ biome:'cali', warm:40, px:-34, py:1, pz:-14, cx:-6, cy:12, cz:8, tx:-40, ty:3, tz:-18, name:'B5-gato.png' })
  await cam({ biome:'cali', warm:40, px:30, py:1, pz:-20, cx:6, cy:16, cz:6, tx:34, ty:8, tz:-22, name:'B5-ermita.png' })
  await cam({ biome:'cali', warm:40, px:-84, py:18, pz:-46, cx:-70, cy:26, cz:-30, tx:-95, ty:14, tz:-58, name:'B5-mirador.png' })
  await cam({ biome:'cali', warm:40, px:-122, py:1, pz:-84, cx:-96, cy:44, cz:-58, tx:-126, ty:34, tz:-88, name:'B5-cristo.png' })
}
