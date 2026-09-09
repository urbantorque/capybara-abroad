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
  const K='kowloon'
  await cam({ biome:K, warm:2600, px:-11,py:35,pz:0, cx:-6,cy:40,cz:20, tx:-14,ty:32,tz:-60, name:'X2-hk-show.png' })
  const st = await page.evaluate(() => ({ show: window.__capy.kowloon.show(), lit: window.__capy.kowloon.litTowers(), err: window.__capy.state.lastError||null }))
  await page.evaluate(async (o) => { await fetch('/shot?name=wg.json', { method:'POST', body: btoa(JSON.stringify(o)) }) }, st)
  await cam({ biome:K, warm:120, px:0,py:1.4,pz:-58, cx:-42,cy:16,cz:-42, tx:6,ty:6,tz:-100, name:'X2-hk-harbour.png' })
  await cam({ biome:K, warm:60, px:0,py:1.4,pz:0, cx:0,cy:3.2,cz:16, tx:0,ty:7,tz:-24, name:'X2-hk-street.png' })
}
