async page => {
  await page.reload()
  await page.waitForTimeout(5600)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(2600)
  await page.evaluate(() => { window.__capy.renderer.setSize(1280, 760, false) })

  // --- the jaguar, from the crossing, mid-stalk ---
  await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('pantanal')
    g.capy.body.position.set(0, 2.1, 62)
    await new Promise(r => setTimeout(r, 2600))
    const J = g.pantanal
    J.herdToCrossing(); J.forceJaguar()
    // wait for her to be on the bank, then stand off her shoulder
    const t0 = Date.now()
    while (Date.now() - t0 < 40000) {
      await new Promise(r => setTimeout(r, 200))
      const d = J.jaguarDebug()
      if (d.st === 'stalk' && d.u > 0.25) {
        g.capy.body.position.set(d.x + 7, J.terrainHeight(d.x + 7, d.z + 11) + 0.4, d.z + 11)
        g.capy.body.velocity.set(0, 0, 0)
        g.input.camYaw = Math.atan2(d.x - (d.x + 7), d.z - (d.z + 11))
        await new Promise(r => setTimeout(r, 2200))
        break
      }
    }
  })
  await page.screenshot({ path: 'qa/T5-jaguar.png' })
  await page.evaluate(async () => {
    const g = window.__capy, J = g.pantanal
    const d = J.jaguarDebug()
    g.capy.body.position.set(d.x + 3.2, J.terrainHeight(d.x + 3.2, d.z + 4.5) + 0.4, d.z + 4.5)
    await new Promise(r => setTimeout(r, 1600))
  })
  await page.screenshot({ path: 'qa/T5-jaguar-close.png' })

  // --- Cappadocia, the near balloon leaving ---
  await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('goreme')
    const sp = g.biome.spawnOf('goreme')
    g.capy.body.position.set(sp.x, sp.y, sp.z)
    await new Promise(r => setTimeout(r, 2600))
    g.goreme.setPhase(0.30)
    await new Promise(r => setTimeout(r, 7000))
    g.capy.body.position.set(2, g.goreme.terrainHeight(2, 26) + 0.4, 26)
    g.input.camYaw = 0
    await new Promise(r => setTimeout(r, 2000))
  })
  await page.screenshot({ path: 'qa/T5-goreme-launch.png' })

  // --- Antarctica, the colony up after a strike ---
  await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('antarctic')
    const sp = g.biome.spawnOf('antarctic')
    g.capy.body.position.set(sp.x, sp.y, sp.z)
    await new Promise(r => setTimeout(r, 2600))
    const A = g.antarctic
    A.skuaTo(0.55)
    const d0 = A.skuaDebug()
    g.capy.body.position.set(d0.x + 10, 6, d0.z + 22)
    await new Promise(r => setTimeout(r, 3000))
  })
  await page.screenshot({ path: 'qa/T5-skua.png' })
  const err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=T5-shots.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), { err })
}
