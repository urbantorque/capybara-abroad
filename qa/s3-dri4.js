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
      if (o.light) {
        // wake six lampflies and light the lantern the way the player would
        g.drift.debugLight ? g.drift.debugLight() : null
      }
      for (let i=0;i<(o.warm||60);i++) { g.tick(1/60,false); b.position.set(o.px,o.py,o.pz); b.velocity.set(0,0,0) }
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280/760; g.camera.fov = o.fov||50; g.camera.far = 4000
      g.camera.updateProjectionMatrix()
      g.camera.position.set(o.cx, o.cy, o.cz)
      g.camera.lookAt(new THREE.Vector3(o.tx, o.ty, o.tz))
      g.camera.updateMatrixWorld(true)
      g.renderer.render(g.scene, g.camera)
      await fetch('/shot?name=' + o.name, { method:'POST', body: g.renderer.domElement.toDataURL('image/png').split(',')[1] })
    }, q)
  }
  await cam({ biome:'drift', warm:200, px:-38, py:81, pz:-114, cx:-30, cy:84, cz:-104, tx:-42, ty:81, tz:-120, name:'D4-flies.png' })
  await cam({ biome:'drift', px:36, py:109, pz:-176, cx:36, cy:116, cz:-162, tx:36, ty:110, tz:-196, name:'D4-crown.png' })
  const info = await page.evaluate(() => {
    const g = window.__capy
    return { keys: Object.keys(g.drift || {}), e: g.state.lastError?String(g.state.lastError):'none' }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=dri4.json', { method:'POST', body: btoa(JSON.stringify(o)) }) }, info)
}
