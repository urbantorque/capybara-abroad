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
      b.velocity.set(0,0,0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i=0;i<16;i++) g.tick(1/60,false)
    }
    // in the river, so the dusk fires
    for (let s=0;s<26;s++){
      z -= 1
      b.position.set(-34, Math.max(g.pantanal.terrainHeight(-34,z)+0.4, g.pantanal.waterLevel-0.2), z)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i=0;i<20;i++) g.tick(1/60,false)
    }
    // and let the light come all the way up
    for (let i=0;i<900;i++) g.tick(1/60,false)
    // now go and look at the farm
    b.position.set(30, 4, 60)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i=0;i<180;i++) g.tick(1/60,false)
  })
  const st = await page.evaluate(async () => {
    const g = window.__capy
    g.renderer.setSize(1280, 760, false)
    g.camera.aspect = 1280/760; g.camera.updateProjectionMatrix()
    const p = g.capy.position
    g.camera.position.set(36, 9, 56)
    g.camera.lookAt(36, 5.2, 71)
    g.camera.updateMatrixWorld(true)
    g.post.render()
    await fetch('/shot?name=Z-pan-dusk', { method:'POST', body: g.renderer.domElement.toDataURL('image/png') })
    return { dusk: +g.pantanal.dusk().toFixed(2), following: g.pantanal.following() }
  })
  await page.evaluate(async (o)=>{ await fetch('/shot?name=xdusk.json',{method:'POST',body:btoa(JSON.stringify(o))}) }, st)
}
