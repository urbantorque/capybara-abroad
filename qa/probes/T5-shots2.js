async page => {
  await page.reload()
  await page.waitForTimeout(5600)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(2600)
  await page.evaluate(() => { window.__capy.renderer.setSize(1280, 760, false) })

  // C1: the near balloon, WITH its basket, off the ground
  await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('goreme')
    const sp = g.biome.spawnOf('goreme')
    g.capy.body.position.set(sp.x, sp.y, sp.z)
    await new Promise(r => setTimeout(r, 2600))
    const G = g.goreme
    G.setPhase(0.295)
    await new Promise(r => setTimeout(r, 5000))
    const d = G.fieldDebug()
    // stand south of it and look north at it
    const px = d.launchX, pz = 34
    g.capy.body.position.set(px, G.terrainHeight(px, pz) + 0.4, pz)
    g.capy.body.velocity.set(0, 0, 0)
    g.input.camYaw = 0
    await new Promise(r => setTimeout(r, 2200))
  })
  await page.screenshot({ path: 'qa/T5-goreme-basket.png' })
  const gd = await page.evaluate(() => window.__capy.goreme.fieldDebug())

  // the colony, from the south, at the moment of the strike
  await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('antarctic')
    const sp = g.biome.spawnOf('antarctic')
    g.capy.body.position.set(sp.x, sp.y, sp.z)
    await new Promise(r => setTimeout(r, 2600))
    const A = g.antarctic
    const c = A.colony
    // stand SOUTH of the colony (smaller z) looking north (+z) at it
    const px = c.x, pz = c.z - 34
    g.capy.body.position.set(px, A.terrainHeight(px, pz) + 0.4, pz)
    g.capy.body.velocity.set(0, 0, 0)
    g.input.camYaw = Math.PI
    A.skuaTo(0.56)
    await new Promise(r => setTimeout(r, 2600))
  })
  await page.screenshot({ path: 'qa/T5-colony.png' })
  const ad = await page.evaluate(() => window.__capy.antarctic.skuaDebug())
  await page.waitForTimeout(1800)
  await page.screenshot({ path: 'qa/T5-colony-after.png' })
  const ad2 = await page.evaluate(() => window.__capy.antarctic.skuaDebug())
  const err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=T5-shots2.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), { gd, ad, ad2, err })
}
