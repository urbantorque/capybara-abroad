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
  await cam({ biome:V, warm:120, px:-4,py:1.6,pz:-20, cx:-4,cy:6,cz:-8, tx:-4,ty:8,tz:-60, name:'W2-ven-down.png' })
  await cam({ biome:V, warm:60, px:-4,py:1.6,pz:-46, cx:-4,cy:5,cz:-36, tx:-4,ty:16,tz:-62, name:'W2-ven-facade.png' })
  await cam({ biome:V, warm:60, px:6,py:1.6,pz:-46, cx:-6,cy:8,cz:-34, tx:12,ty:20,tz:-52, name:'W2-ven-torre.png' })
  await cam({ biome:V, warm:60, px:0,py:1.6,pz:-4, cx:-12,cy:9,cz:6, tx:12,ty:26,tz:-18, name:'W2-ven-campanile.png' })
  await cam({ biome:V, warm:60, px:-4,py:1.6,pz:2, cx:-4,cy:5,cz:14, tx:8,ty:8,tz:-16, name:'W2-ven-piazzetta.png' })
  const err = await page.evaluate(() => (window.__capy.state.lastError || 'none'))
  await page.evaluate(async (o) => { await fetch('/shot?name=w5err.json', { method:'POST', body: btoa(String(o)) }) }, err)
}
