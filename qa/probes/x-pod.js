async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('antarctic')
    for (let i=0;i<200;i++) g.tick(1/60,false)
    // stand at the tiller
    const an = g.antarctic
    const b = g.capy.body
    const h = an.boat.helm
    b.position.set(h.x, h.y + 0.4, h.z); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    g.input.actionPressed = true
    g.tick(1/60,false)
    g.input.actionPressed = false
    for (let i=0;i<30;i++) g.tick(1/60,false)
    return { atHelm: an.atHelm() }
  })
  // full ahead, steer north
  const run = await page.evaluate(() => {
    const g = window.__capy
    const an = g.antarctic
    const R = { log: [] }
    for (let s=0; s<60; s++) {
      for (let i=0;i<60;i++) { g.input.z = -1; g.input.x = 0; g.tick(1/60,false) }
      if (s === 10) g.events.emit('capy:wheek', {position: g.capy.position})
      if (s % 10 === 0) R.log.push([s, +an.boat.speed.toFixed(1), +an.pack().toFixed(2), +an.withPod().toFixed(2), Math.round(an.boat.position.z)])
    }
    g.input.z = 0
    return R
  })
  await page.evaluate(async () => {
    const g = window.__capy
    g.renderer.setSize(1280, 760, false)
    g.camera.aspect = 1280/760; g.camera.updateProjectionMatrix()
    for (let i=0;i<30;i++){ g.input.z=-1; g.tick(1/60,false) }
    g.tick(1/60, true)
    await fetch('/shot?name=Z-ant-pod', { method:'POST', body: g.renderer.domElement.toDataURL('image/png') })
  })
  const st = await page.evaluate(() => {
    const g = window.__capy
    return { withPod: +g.antarctic.withPod().toFixed(2), seen: g.antarctic.seenPod(), spd: +g.antarctic.boat.speed.toFixed(1) }
  })
  await page.evaluate(async (o)=>{ await fetch('/shot?name=xpod.json',{method:'POST',body:btoa(JSON.stringify(o))}) }, {out, run, st})
}
