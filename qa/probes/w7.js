async page => {
  await page.reload(); await page.waitForTimeout(5000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const cam = async (o) => {
    await page.evaluate(async (q) => {
      const g = window.__capy, THREE = g.THREE
      if (g.biome.current !== q.biome) { g.biome.switchTo(q.biome) }
      const b = g.capy.body
      b.position.set(q.px, q.py, q.pz); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i=0;i<(q.warm||60);i++) { g.tick(1/60, false); b.position.set(q.px,q.py,q.pz); b.velocity.set(0,0,0) }
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280/760; g.camera.fov = q.fov || 46; g.camera.far = 3000
      g.camera.updateProjectionMatrix()
      g.camera.position.set(q.cx, q.cy, q.cz)
      g.camera.lookAt(new THREE.Vector3(q.tx, q.ty, q.tz))
      g.camera.updateMatrixWorld(true)
      g.renderer.render(g.scene, g.camera)
      const d = g.renderer.domElement.toDataURL('image/png')
      await fetch('/shot?name=' + q.name, { method:'POST', body: d.split(',')[1] })
    }, o)
  }
  const V='venice'
  await cam({ biome:V, warm:90, px:-18,py:1.6,pz:-24, cx:-18.5,cy:2.6,cz:-12, tx:-19,ty:2.2,tz:-40, name:'W3-ven-arcade.png' })
  await cam({ biome:V, warm:60, px:-18,py:1.6,pz:-20, cx:-13,cy:3.0,cz:-19, tx:-21,ty:2.4,tz:-21, name:'W3-ven-cafe.png' })
  await cam({ biome:V, warm:60, px:-52,py:1.6,pz:-26, cx:-46,cy:3.4,cz:-26, tx:-64,ty:3,tz:-26, name:'W3-ven-calli.png' })
  await cam({ biome:V, warm:60, px:-62,py:1.6,pz:-10, cx:-56,cy:5,cz:-2, tx:-64,ty:0,tz:-24, name:'W3-ven-rio.png' })
  await cam({ biome:V, warm:60, px:-4,py:1.6,pz:2, cx:-4,cy:6,cz:16, tx:8,ty:16,tz:-18, name:'W3-ven-loggetta.png' })
  await cam({ biome:V, warm:60, px:6,py:1.6,pz:-48, cx:-4,cy:6,cz:-38, tx:14,ty:20,tz:-54, name:'W3-ven-torre.png' })
}
