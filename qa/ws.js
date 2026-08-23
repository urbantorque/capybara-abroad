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
  const V='venice', K='kowloon'
  await cam({ biome:V, warm:150, px:-4,py:1.6,pz:9, cx:-4,cy:5,cz:20, tx:-4,ty:5,tz:-14, name:'Z1-ven-arrival.png' })
  await cam({ biome:V, warm:60, px:-4,py:1.6,pz:-20, cx:-4,cy:6,cz:-6, tx:-4,ty:9,tz:-58, name:'Z1-ven-square.png' })
  await cam({ biome:V, warm:60, px:-8,py:1.6,pz:-16, cx:-12,cy:7,cz:-2, tx:10,ty:24,tz:-30, name:'Z1-ven-campanile.png' })
  await cam({ biome:V, warm:60, px:-18,py:1.6,pz:-28, cx:-18.5,cy:2.6,cz:-14, tx:-19,ty:2.2,tz:-42, name:'Z1-ven-arcade.png' })
  await cam({ biome:V, warm:60, px:8,py:1.6,pz:-40, cx:-6,cy:14,cz:-32, tx:14,ty:26,tz:-50, name:'Z2-ven-torretop.png' })
  await cam({ biome:V, warm:60, px:2,py:1.6,pz:-24, cx:-8,cy:16,cz:-6, tx:14,ty:42,tz:-20, name:'Z2-ven-belfry.png' })
  await cam({ biome:V, warm:60, px:-54,py:1.6,pz:-24, cx:-48,cy:4.5,cz:-16, tx:-60,ty:2,tz:-30, name:'Z1-ven-campo.png' })
  const info = await page.evaluate(() => ({ err: window.__capy.state.lastError || null }))
  await page.evaluate(async (o) => { await fetch('/shot?name=wrerr.json', { method:'POST', body: btoa(JSON.stringify(o)) }) }, info)
}
