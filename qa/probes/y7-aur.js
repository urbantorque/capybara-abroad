async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const shoot = async (q) => {
    await page.evaluate(async (o) => {
      const g = window.__capy, THREE = g.THREE
      if (g.biome.current !== 'iceland') g.biome.switchTo('iceland')
      const b = g.capy.body
      b.position.set(o.px, o.py, o.pz); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      // sit in the pool until the aurora arms and then run it up
      if (o.aur) {
        for (let i=0;i<900;i++) { g.tick(1/60,false); b.position.set(o.px,o.py,o.pz); b.velocity.set(0,0,0) }
      }
      for (let i=0;i<(o.warm||60);i++) { g.tick(1/60,false); if (o.hold) { b.position.set(o.px,o.py,o.pz); b.velocity.set(0,0,0) } }
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280/760; g.camera.fov = 50; g.camera.far = 3000
      g.camera.updateProjectionMatrix()
      if (o.cx !== undefined) {
        g.camera.position.set(o.cx, o.cy, o.cz)
        g.camera.lookAt(new THREE.Vector3(o.tx, o.ty, o.tz))
        g.camera.updateMatrixWorld(true)
        g.renderer.render(g.scene, g.camera)
      } else g.tick(1/60, true)
      const d = g.renderer.domElement.toDataURL('image/png')
      await fetch('/shot?name=' + o.name, { method:'POST', body: d.split(',')[1] })
    }, q)
  }
  await shoot({ px:-40, py:0.2, pz:-10, aur:1, hold:1, warm:60, name:'Z9-aurora-spring.png' })
  await shoot({ px:26, py:1.5, pz:136, hold:1, warm:120, cx:26, cy:16, cz:112, tx:20, ty:14, tz:170, name:'Z9-aurora-bay.png' })
  await shoot({ px:0, py:1.4, pz:99, hold:1, warm:90, name:'Z9-aurora-town.png' })
  const lvl = await page.evaluate(() => ({ aurora: window.__capy.iceland.aurora(), skyward: window.__capy.iceland.skyward() }))
  await page.evaluate(async (o) => { await fetch('/shot?name=y7aur.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, lvl)
}
