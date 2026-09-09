async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('pantanal')
    for (let i=0;i<200;i++) g.tick(1/60,false)
    const b = g.capy.body
    b.position.set(-14, 1.2, 34); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i=0;i<120;i++) g.tick(1/60,false)
    for (let k=0;k<6;k++){ g.events.emit('capy:wheek', {position: g.capy.position}); for (let i=0;i<40;i++) g.tick(1/60,false) }
    let x = b.position.x, z = b.position.z
    for (let step=0; step<200; step++){
      const dx = -34 - x, dz = -46 - z
      const d = Math.hypot(dx,dz); if (d < 1) break
      x += dx/d; z += dz/d
      b.position.set(x, Math.max(g.pantanal.terrainHeight(x,z)+0.5, 0.5), z)
      b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i=0;i<20;i++) g.tick(1/60,false)
    }
    g.renderer.setSize(1280, 760, false)
    g.camera.aspect = 1280/760; g.camera.updateProjectionMatrix()
  })
  for (let step=0; step<10; step++){
    await page.evaluate(async (n) => {
      const g = window.__capy
      const b = g.capy.body
      let z = b.position.z
      for (let k=0;k<3;k++){
        z -= 1.0
        b.position.set(-34, Math.max(g.pantanal.terrainHeight(-34,z)+0.4, g.pantanal.waterLevel-0.2), z)
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
        for (let i=0;i<24;i++) g.tick(1/60,false)
      }
      // the real gameplay rig, aimed the way the animal is going
      const p = g.capy.position
      g.camera.position.set(p.x, p.y + 7.4, p.z + 7.4)
      g.camera.lookAt(p.x, p.y + 0.3, p.z)
      g.camera.updateMatrixWorld(true)
      g.post.render()
      await fetch('/shot?name=Z-cross-'+n, { method:'POST', body: g.renderer.domElement.toDataURL('image/png') })
    }, step)
  }
}
