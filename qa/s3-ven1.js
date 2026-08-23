async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const cam = async (q) => {
    await page.evaluate(async (o) => {
      const g = window.__capy, THREE = g.THREE
      if (g.biome.current !== o.biome) g.biome.switchTo(o.biome)
      const b = g.capy.body
      b.position.set(o.px, o.py, o.pz); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i=0;i<(o.warm||60);i++) { g.tick(1/60,false); b.position.set(o.px,o.py,o.pz); b.velocity.set(0,0,0) }
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280/760; g.camera.fov = o.fov||50; g.camera.far = 3000
      g.camera.updateProjectionMatrix()
      g.camera.position.set(o.cx, o.cy, o.cz)
      g.camera.lookAt(new THREE.Vector3(o.tx, o.ty, o.tz))
      g.camera.updateMatrixWorld(true)
      g.renderer.render(g.scene, g.camera)
      await fetch('/shot?name=' + o.name, { method:'POST', body: g.renderer.domElement.toDataURL('image/png').split(',')[1] })
    }, q)
  }
  await cam({ biome:'venice', warm:150, px:-4, py:1.6, pz:13, cx:-4, cy:7, cz:24, tx:-4, ty:3, tz:-6, name:'V1-arrival.png' })
  await cam({ biome:'venice', px:-10, py:1.6, pz:-20, cx:-2, cy:4.2, cz:-20, tx:-19, ty:3.0, tz:-22, name:'V1-arcade.png' })
  await cam({ biome:'venice', px:-4, py:1.6, pz:-24, cx:-4, cy:9, cz:-12, tx:-4, ty:5, tz:-56, name:'V1-piazza.png' })
  await cam({ biome:'venice', px:-12, py:1.6, pz:-31, cx:-2, cy:3.6, cz:-31, tx:-30, ty:2.4, tz:-31, name:'V1-soto.png' })
  await cam({ biome:'venice', px:-17.8, py:1.0, pz:-20, cx:-13, cy:3.4, cz:-14, tx:-19, ty:1.6, tz:-24, name:'V1-cafe.png' })
  const err = await page.evaluate(() => window.__capy.state.lastError ? String(window.__capy.state.lastError) : 'none')
  await page.evaluate(async (o) => { await fetch('/shot?name=v1err.json', { method:'POST', body: btoa(String(o)) }) }, err)
}
