async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  await page.evaluate(async () => {
    const g = window.__capy
    const sleep = ms => new Promise(r => setTimeout(r, ms))
    g.biome.switchTo('pantanal'); g.state.lastError = null
    await sleep(1800)
    const b = g.capy.body
    for (let k = 0; k < 6; k++) {
      const h0 = g.pantanal.herd()
      const h = { x: h0.x, y: h0.y, z: h0.z }
      b.position.set(h.x + 1.6, g.pantanal.terrainHeight(h.x + 1.6, h.z + 1.6) + 0.6, h.z + 1.6)
      b.velocity.set(0,0,0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      await sleep(700)
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', bubbles: true }))
      await sleep(70)
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyQ', bubbles: true }))
      await sleep(1250)
    }
  })
  const before = await page.evaluate(() => window.__capy.pantanal.following())
  await page.evaluate(async () => {
    const g = window.__capy
    g.renderer.setSize(1280, 760, false)
    g.tick(1/60, true)
    await fetch('/shot?name=pan-preDusk', { method:'POST', body: g.renderer.domElement.toDataURL('image/png') })
  })
  // into the river, in the crossing lane
  for (let k = 0; k < 5; k++) {
    await page.evaluate(async () => {
      const g = window.__capy
      const b = g.capy.body
      b.position.set(-34, 0.2, -68); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      await new Promise(r => setTimeout(r, 4200))
    })
  }
  // ...and on LAND, which is where the light can be judged
  await page.evaluate(async () => {
    const g = window.__capy, b = g.capy.body
    b.position.set(20, g.pantanal.terrainHeight(20, 30) + 0.6, 30); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    await new Promise(r => setTimeout(r, 3000))
    g.renderer.setSize(1280, 760, false)
    g.tick(1/60, true)
    await fetch('/shot?name=pan-duskLand', { method:'POST', body: g.renderer.domElement.toDataURL('image/png') })
  })
  const out = await page.evaluate(async () => {
    const g = window.__capy
    g.renderer.setSize(1280, 760, false)
    g.tick(1/60, true)
    await fetch('/shot?name=pan-dusk', { method:'POST', body: g.renderer.domElement.toDataURL('image/png') })
    return { following: g.pantanal.following(), dusk: +g.pantanal.dusk().toFixed(3),
             crossing: g.pantanal.crossing(), err: g.state.lastError || null }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=p5dusk.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
