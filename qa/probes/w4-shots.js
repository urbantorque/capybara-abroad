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
      g.camera.aspect = 1280/760
      g.camera.fov = q.fov || 46
      g.camera.far = 3000
      g.camera.updateProjectionMatrix()
      g.camera.position.set(q.cx, q.cy, q.cz)
      g.camera.lookAt(new THREE.Vector3(q.tx, q.ty, q.tz))
      g.camera.updateMatrixWorld(true)
      g.renderer.render(g.scene, g.camera)
      const d = g.renderer.domElement.toDataURL('image/png')
      await fetch('/shot?name=' + q.name, { method:'POST', body: d.split(',')[1] })
    }, o)
  }
  const V = 'venice', K = 'kowloon'
  // Venice: the walk down the square
  await cam({ biome:V, warm:200, px:-4,py:1.6,pz:13, cx:-4,cy:5,cz:22, tx:-4,ty:3,tz:-10, name:'W1-ven-arrival.png' })
  await cam({ biome:V, warm:60, px:-4,py:1.6,pz:-20, cx:-4,cy:6,cz:-8, tx:-4,ty:6,tz:-60, name:'W1-ven-down.png' })
  await cam({ biome:V, warm:60, px:-4,py:1.6,pz:-30, cx:-20,cy:4,cz:-31, tx:0,ty:3.5,tz:-31, name:'W1-ven-soto.png' })
  await cam({ biome:V, warm:60, px:12,py:1.6,pz:-17, cx:-6,cy:14,cz:6, tx:12,ty:30,tz:-17, name:'W1-ven-campanile.png' })
  await cam({ biome:V, warm:60, px:-4,py:1.6,pz:-52, cx:-4,cy:4,cz:-40, tx:-4,ty:12,tz:-62, name:'W1-ven-facade.png' })
  await cam({ biome:V, warm:60, px:-54,py:1.6,pz:-24, cx:-54,cy:5,cz:-14, tx:-54,ty:3,tz:-30, name:'W1-ven-campo.png' })
  await cam({ biome:V, warm:60, px:-100,py:2,pz:-10, cx:-92,cy:8,cz:6, tx:-112,ty:2,tz:-26, name:'W1-ven-rialto.png' })
  // Kowloon
  await cam({ biome:K, warm:200, px:0,py:1.4,pz:34, cx:0,cy:4,cz:44, tx:0,ty:6,tz:10, name:'W1-hk-arrival.png' })
  await cam({ biome:K, warm:60, px:0,py:1.4,pz:0, cx:0,cy:3.2,cz:16, tx:0,ty:8,tz:-24, name:'W1-hk-street.png' })
  await cam({ biome:K, warm:60, px:-8,py:1.4,pz:0, cx:2,cy:5,cz:16, tx:-11,ty:22,tz:-2, name:'W1-hk-scaffold.png' })
  await cam({ biome:K, warm:60, px:8,py:1.4,pz:-24, cx:2,cy:3,cz:-14, tx:9,ty:1.6,tz:-26, name:'W1-hk-dpd.png' })
  await cam({ biome:K, warm:60, px:29,py:1.4,pz:18, cx:14,cy:3,cz:18, tx:34,ty:2,tz:18, name:'W1-hk-market.png' })
  await cam({ biome:K, warm:60, px:0,py:1.4,pz:-56, cx:0,cy:6,cz:-46, tx:0,ty:2,tz:-72, name:'W1-hk-pier.png' })
  await cam({ biome:K, warm:60, px:-11,py:35,pz:0, cx:-6,cy:40,cz:22, tx:-14,ty:30,tz:-40, name:'W1-hk-roof.png' })
  await cam({ biome:K, warm:60, px:0,py:1.4,pz:36, cx:4,cy:5,cz:52, tx:-3.4,ty:3,tz:30, name:'W1-hk-lion.png' })
}
