async page => {
  await page.reload()
  await page.waitForTimeout(5600)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(2600)
  await page.evaluate(() => { window.__capy.renderer.setSize(1280, 760, false) })
  const info = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('goreme')
    const sp = g.biome.spawnOf('goreme')
    g.capy.body.position.set(sp.x, sp.y, sp.z)
    await new Promise(r => setTimeout(r, 2600))
    const G = g.goreme
    // stand well back on open ground, south of the field, looking north
    const px = 12, pz = 44
    g.capy.body.position.set(px, G.terrainHeight(px, pz) + 0.4, pz)
    g.capy.body.velocity.set(0, 0, 0)
    g.input.camYaw = 0
    G.setPhase(0.288)
    await new Promise(r => setTimeout(r, 5200))
    return G.fieldDebug()
  })
  await page.screenshot({ path: 'qa/T5-bal-a.png' })
  const info2 = await page.evaluate(async () => {
    const g = window.__capy
    await new Promise(r => setTimeout(r, 5200))
    return g.goreme.fieldDebug()
  })
  await page.screenshot({ path: 'qa/T5-bal-b.png' })
  await page.evaluate(o => fetch('/shot?name=T5-bal.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), { info, info2 })
}
