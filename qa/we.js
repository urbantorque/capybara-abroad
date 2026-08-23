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
      // run the tide forward to the top
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
  // 0.055 start; RISE1 = 0.5 = full. 205 s cycle. 0.5-0.055 = 0.445 -> 91 s -> 5480 ticks
  await cam({ biome:'venice', warm:6200, px:-4,py:1.6,pz:-20, cx:-4,cy:5,cz:-6, tx:-4,ty:6,tz:-58, name:'W5-ven-flood.png' })
  const t = await page.evaluate(() => ({ tide: window.__capy.venice.tide(), y: window.__capy.venice.tideY(), up: window.__capy.venice.pigeonsUp() }))
  await page.evaluate(async (o) => { await fetch('/shot?name=we.json', { method:'POST', body: btoa(JSON.stringify(o)) }) }, t)
  await cam({ biome:'venice', warm:60, px:-4,py:1.6,pz:-20, cx:-14,cy:2.2,cz:-14, tx:2,ty:1.5,tz:-30, name:'W5-ven-flood-low.png' })
}
