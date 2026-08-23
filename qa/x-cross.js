async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('pantanal')
    for (let i=0;i<200;i++) g.tick(1/60,false)
    // recruit five of the herd by hand, then put them behind us
    const b = g.capy.body
    b.position.set(-34, 1.2, -46); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i=0;i<120;i++) g.tick(1/60,false)
  })
  // wheek five times, walking south, to build a trail and a line
  await page.evaluate(() => {
    const g = window.__capy
    for (let k=0;k<6;k++){
      // place a grazer next to us so the 16 m test finds it
      g.events.emit('capy:wheek', {position: g.capy.position})
      for (let i=0;i<20;i++) g.tick(1/60,false)
    }
  })
  const info = await page.evaluate(() => {
    const g = window.__capy
    return { following: g.pantanal.following() }
  })
  // now swim south into the river
  for (let step=0; step<10; step++) {
    await page.evaluate(() => {
      const g = window.__capy
      const b = g.capy.body
      b.position.z -= 3.0
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i=0;i<60;i++) g.tick(1/60,false)
    })
  }
  await page.evaluate(async () => {
    const g = window.__capy
    g.renderer.setSize(1280, 760, false)
    g.camera.aspect = 1280/760; g.camera.updateProjectionMatrix()
    g.tick(1/60, true)
    await fetch('/shot?name=Y-pan-crossing', { method:'POST', body: g.renderer.domElement.toDataURL('image/png') })
  })
  const st = await page.evaluate(() => {
    const g = window.__capy
    return { following: g.pantanal.following(), dusk:+g.pantanal.dusk().toFixed(2), crossing: g.pantanal.crossing(),
             capy:[+g.capy.position.x.toFixed(1),+g.capy.position.z.toFixed(1)],
             cam:[+g.camera.position.x.toFixed(1),+g.camera.position.y.toFixed(1),+g.camera.position.z.toFixed(1)] }
  })
  await page.evaluate(async (o)=>{ await fetch('/shot?name=xcross.json',{method:'POST',body:btoa(JSON.stringify(o))}) }, st)
}
