async page => {
  await page.reload(); await page.waitForTimeout(5500)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const cam = async (o) => {
    await page.evaluate(async (q) => {
      const g = window.__capy, THREE = g.THREE
      if (g.biome.current !== q.biome) { g.biome.switchTo(q.biome) }
      const b = g.capy.body
      b.position.set(q.px, q.py, q.pz); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i=0;i<(q.warm||60);i++) { g.tick(1/60, false); b.position.set(q.px,q.py,q.pz); b.velocity.set(0,0,0) }
      g.renderer.setSize(1440, 860, false)
      g.camera.aspect = 1440/860; g.camera.fov = q.fov || 46; g.camera.far = 3000
      g.camera.updateProjectionMatrix()
      g.camera.position.set(q.cx, q.cy, q.cz)
      g.camera.lookAt(new THREE.Vector3(q.tx, q.ty, q.tz))
      g.camera.updateMatrixWorld(true)
      g.renderer.render(g.scene, g.camera)
      const d = g.renderer.domElement.toDataURL('image/png')
      await fetch('/shot?name=' + q.name, { method:'POST', body: d.split(',')[1] })
    }, o)
  }
  await cam({ biome:'venice', warm:200, px:-4,py:1.6,pz:-16, cx:-4,cy:5.5,cz:-2, tx:-4,ty:10,tz:-58, name:'HERO-venice-dry.png' })
  await cam({ biome:'venice', warm:5900, px:-4,py:1.6,pz:-20, cx:-6,cy:4.2,cz:-8, tx:-2,ty:9,tz:-58, name:'HERO-venice-flood.png' })
  const t = await page.evaluate(() => ({ tide: +window.__capy.venice.tide().toFixed(2), up: window.__capy.venice.pigeonsUp() }))
  await cam({ biome:'kowloon', warm:200, px:0,py:1.4,pz:6, cx:0,cy:3.0,cz:20, tx:0,ty:8,tz:-26, name:'HERO-kowloon-street.png' })
  await cam({ biome:'kowloon', warm:6600, px:-11,py:35,pz:0, cx:-3,cy:39.5,cz:20, tx:-13,ty:33,tz:-64, name:'HERO-kowloon-show.png' })
  const k = await page.evaluate(() => ({ show: +window.__capy.kowloon.show().toFixed(2), lit: window.__capy.kowloon.litTowers(), err: window.__capy.state.lastError||null }))
  await page.evaluate(async (o) => { await fetch('/shot?name=wx.json', { method:'POST', body: btoa(JSON.stringify(o)) }) }, { t, k })
}
