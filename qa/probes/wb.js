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
      if (q.tide !== undefined && g.venice && g.venice.setPhase) g.venice.setPhase(q.tide)
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
  await cam({ biome:V, warm:90, px:-60,py:1.6,pz:-6, cx:-56,cy:4.4,cz:0, tx:-66,ty:0,tz:-8, name:'W4-ven-rio.png' })
  await cam({ biome:V, warm:60, px:-97,py:2,pz:-17, cx:-96,cy:14,cz:-6, tx:-101,ty:0,tz:-19, name:'W4-ven-fruit.png' })
  await cam({ biome:V, warm:60, px:-18,py:1.6,pz:-30, cx:-18.5,cy:2.6,cz:-16, tx:-19,ty:2.2,tz:-44, name:'W4-ven-arcade.png' })
  const info = await page.evaluate(() => ({ err: window.__capy.state.lastError || null }))
  await page.evaluate(async (o) => { await fetch('/shot?name=wberr.json', { method:'POST', body: btoa(JSON.stringify(o)) }) }, info)
}
