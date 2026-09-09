async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const cam = async (q) => {
    await page.evaluate(async (o) => {
      const g = window.__capy, THREE = g.THREE
      if (g.biome.current !== o.biome) g.biome.switchTo(o.biome)
      const b = g.capy.body
      b.position.set(o.px, o.py, o.pz); b.velocity.set(0,0,0)
      for (let i=0;i<(o.warm||90);i++) { g.tick(1/60,false); if (o.hold) { b.position.set(o.px,o.py,o.pz); b.velocity.set(0,0,0) } }
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
  await cam({ biome:'venice', hold:1, warm:200, px:-4, py:1.6, pz:13, cx:-4, cy:7, cz:24, tx:-4, ty:3, tz:-6, name:'F-ven-arrival.png' })
  await cam({ biome:'venice', hold:1, px:-14, py:1.6, pz:-24, cx:-6, cy:4.4, cz:-22, tx:-20, ty:3.2, tz:-27, name:'F-ven-arcade.png' })
  await cam({ biome:'kowloon', hold:1, warm:300, px:0, py:1.4, pz:6, cx:0, cy:6, cz:26, tx:0, ty:6, tz:-16, name:'F-hk-street.png' })
  await cam({ biome:'drift', hold:1, warm:200, px:2, py:31.6, pz:42, cx:2, cy:37, cz:56, tx:0, ty:31, tz:20, name:'F-dri-arrival.png' })
  await cam({ biome:'drift', hold:1, px:36, py:109, pz:-176, cx:4, cy:128, cz:-146, tx:36, ty:110, tz:-190, name:'F-dri-crown-unlit.png' })
  const err = await page.evaluate(() => window.__capy.state.lastError ? String(window.__capy.state.lastError) : 'none')
  await page.evaluate(async (o) => { await fetch('/shot?name=ffinal.json', { method:'POST', body: btoa(String(o)) }) }, err)
}
