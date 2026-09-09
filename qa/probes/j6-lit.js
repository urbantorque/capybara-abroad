async page => {
  await page.reload(); await page.waitForTimeout(6000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const cam = async (o) => {
    await page.evaluate(async (q) => {
      const g = window.__capy, THREE = g.THREE
      if (g.biome.current !== q.biome) { g.biome.switchTo(q.biome) }
      const b = g.capy.body
      const ter = g[q.api].terrainHeight
      b.position.set(q.px, ter(q.px,q.pz)+0.5, q.pz); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i=0;i<(q.warm||160);i++) { g.tick(1/60, false); b.position.set(q.px, ter(q.px,q.pz)+0.5, q.pz); b.velocity.set(0,0,0) }
      // FLOOD the room so the geometry is readable
      if (q.flood) {
        if (!window.__flood) { window.__flood = new THREE.HemisphereLight(0xffffff, 0x888888, 2.2); g.scene.add(window.__flood) }
        window.__flood.intensity = 2.2
        g.scene.fog = null
      }
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280/760; g.camera.fov = q.fov||55; g.camera.far = 4000
      g.camera.updateProjectionMatrix()
      g.camera.position.set(q.cx, q.cy, q.cz)
      g.camera.lookAt(new THREE.Vector3(q.tx, q.ty, q.tz))
      g.camera.updateMatrixWorld(true)
      g.renderer.render(g.scene, g.camera)
      const d = g.renderer.domElement.toDataURL('image/png')
      await fetch('/shot?name=' + q.name, { method:'POST', body: d.split(',')[1] })
    }, o)
  }
  await cam({ biome:'cave', api:'cave', px:0, pz:0, flood:1, cx:0, cy:26, cz:60, tx:0, ty:6, tz:-30, name:'K-cav-passwide.png' })
  await cam({ biome:'cave', api:'cave', px:4, pz:-48, flood:1, cx:30, cy:14, cz:-14, tx:0, ty:22, tz:-52, name:'K-cav-dolwide.png' })
  await cam({ biome:'cave', api:'cave', px:4, pz:-30, flood:1, cx:4, cy:3, cz:-24, tx:4, ty:60, tz:-50, name:'K-cav-lookup.png' })
  await cam({ biome:'cave', api:'cave', px:0, pz:-140, flood:1, cx:0, cy:18, cz:-108, tx:0, ty:6, tz:-172, name:'K-cav-farwide.png' })
}
