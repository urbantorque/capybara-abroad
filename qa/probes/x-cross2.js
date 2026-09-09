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
    for (let k=0;k<6;k++){
      g.events.emit('capy:wheek', {position: g.capy.position})
      for (let i=0;i<40;i++) g.tick(1/60,false)
    }
  })
  const a = await page.evaluate(() => ({following: window.__capy.pantanal.following()}))
  // walk south-west to the crossing, one metre at a time so the trail is real
  await page.evaluate(() => {
    const g = window.__capy
    const b = g.capy.body
    const tgt = [[-34, -46]]
    let x = b.position.x, z = b.position.z
    for (let step=0; step<200; step++){
      const dx = -34 - x, dz = -46 - z
      const d = Math.hypot(dx,dz); if (d < 1) break
      x += dx/d*1.0; z += dz/d*1.0
      b.position.set(x, Math.max(g.pantanal.terrainHeight(x,z)+0.5, 0.5), z)
      b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i=0;i<20;i++) g.tick(1/60,false)
    }
  })
  const b2 = await page.evaluate(() => ({following: window.__capy.pantanal.following(), z: +window.__capy.capy.position.z.toFixed(1)}))
  // now into the river
  const frames = []
  for (let step=0; step<9; step++){
    await page.evaluate(() => {
      const g = window.__capy
      const b = g.capy.body
      let z = b.position.z
      for (let k=0;k<3;k++){
        z -= 1.0
        b.position.set(-34, Math.max(g.pantanal.terrainHeight(-34,z)+0.4, g.pantanal.waterLevel-0.2), z)
        g.input.camYaw = Math.PI
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
        for (let i=0;i<24;i++) g.tick(1/60,false)
      }
    })
    await page.evaluate(async (n) => {
      const g = window.__capy
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280/760; g.camera.updateProjectionMatrix()
      g.tick(1/60, true)
      await fetch('/shot?name=Z-cross-'+n, { method:'POST', body: g.renderer.domElement.toDataURL('image/png') })
    }, step)
  }
  const st = await page.evaluate(() => {
    const g = window.__capy
    return { pre:0, following: g.pantanal.following(), dusk:+g.pantanal.dusk().toFixed(2),
             z: +g.capy.position.z.toFixed(1) }
  })
  await page.evaluate(async (o)=>{ await fetch('/shot?name=xcross2.json',{method:'POST',body:btoa(JSON.stringify(o))}) }, {a,b2,st})
}
