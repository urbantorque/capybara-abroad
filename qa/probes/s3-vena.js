async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const cam = async (q) => {
    return await page.evaluate(async (o) => {
      const g = window.__capy, THREE = g.THREE
      if (g.biome.current !== o.biome) g.biome.switchTo(o.biome)
      const b = g.capy.body
      b.position.set(o.px, o.py, o.pz); b.velocity.set(0,0,0)
      for (let i=0;i<(o.warm||60);i++) { g.tick(1/60,false); b.position.set(o.px,o.py,o.pz); b.velocity.set(0,0,0) }
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280/760; g.camera.fov = 50; g.camera.far = 3000
      g.camera.updateProjectionMatrix()
      g.camera.position.set(o.cx, o.cy, o.cz)
      g.camera.lookAt(new THREE.Vector3(o.tx, o.ty, o.tz))
      g.camera.updateMatrixWorld(true)
      g.renderer.render(g.scene, g.camera)
      await fetch('/shot?name=' + o.name, { method:'POST', body: g.renderer.domElement.toDataURL('image/png').split(',')[1] })
      return g.venice.waterLevel
    }, q)
  }
  const dry = await cam({ biome:'venice', warm:120, px:-4, py:1.6, pz:-30, cx:-4, cy:4.0, cz:-18, tx:-4, ty:1.6, tz:-50, name:'VA-dry.png' })
  const wet = await cam({ biome:'venice', warm:60*118, px:-4, py:1.6, pz:-30, cx:-4, cy:4.0, cz:-18, tx:-4, ty:1.6, tz:-50, name:'VA-wet.png' })
  await page.evaluate(async (o) => { await fetch('/shot?name=vainfo.json', { method:'POST', body: btoa(JSON.stringify(o)) }) }, {dry, wet})
}
