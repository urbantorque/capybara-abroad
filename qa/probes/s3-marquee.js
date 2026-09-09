async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const shot = async (q) => {
    await page.evaluate(async (o) => {
      const g = window.__capy, THREE = g.THREE
      if (g.biome.current !== o.biome) g.biome.switchTo(o.biome)
      const b = g.capy.body
      b.position.set(o.px, o.py, o.pz); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      if (o.pre) eval(o.pre)
      for (let i=0;i<(o.warm||60);i++) { g.tick(1/60, false); if (o.hold) { b.position.set(o.px,o.py,o.pz); b.velocity.set(0,0,0) } }
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280/760; g.camera.fov = 50; g.camera.far = 4000
      g.camera.updateProjectionMatrix()
      g.camera.position.set(o.cx, o.cy, o.cz)
      g.camera.lookAt(new THREE.Vector3(o.tx, o.ty, o.tz))
      g.camera.updateMatrixWorld(true)
      g.renderer.render(g.scene, g.camera)
      await fetch('/shot?name=' + o.name, { method:'POST', body: g.renderer.domElement.toDataURL('image/png').split(',')[1] })
    }, q)
  }
  // Venice: run to high tide (period 205 s, top 0.5..0.78 -> phase ~0.63)
  await shot({ biome:'venice', px:-4, py:1.6, pz:-24, hold:1, warm:60*130,
    cx:-4, cy:9, cz:-12, tx:-4, ty:5, tz:-60, name:'U-ven-flood.png' })
  await shot({ biome:'venice', px:-4, py:1.6, pz:-24, hold:1, warm:60*5,
    cx:-24, cy:16, cz:-6, tx:-4, ty:4, tz:-46, name:'U-ven-flood2.png' })
  // Kowloon: run to the show (cycle 152 s, on at 0.545 -> 83 s; start phase 0.06)
  await shot({ biome:'kowloon', px:0, py:1.4, pz:-52, hold:1, warm:60*80,
    cx:0, cy:8, cz:-36, tx:0, ty:14, tz:-120, name:'U-hk-show.png' })
  await shot({ biome:'kowloon', px:0, py:1.4, pz:-52, hold:1, warm:60*12,
    cx:0, cy:8, cz:-36, tx:0, ty:14, tz:-120, name:'U-hk-show2.png' })
  await shot({ biome:'kowloon', px:-10.5, py:35.4, pz:0, hold:1, warm:60*3,
    cx:-2, cy:42, cz:12, tx:-16, ty:30, tz:-40, name:'U-hk-showroof.png' })
}
