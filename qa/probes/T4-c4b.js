async page => {
  await page.reload()
  await page.waitForTimeout(5200)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2200)
  await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('goreme')
    const sp = g.biome.spawnOf('goreme')
    g.capy.body.position.set(sp.x, sp.y, sp.z)
    await new Promise(r => setTimeout(r, 2500))
  })
  const out = {}
  // Does a real key even reach input.honk?
  await page.keyboard.down('KeyQ')
  out.duringDown = await page.evaluate(() => ({
    honk: !!window.__capy.input.honk,
    pressed: !!window.__capy.input.honkPressed,
    started: !!window.__capy.state.started,
  }))
  await page.keyboard.up('KeyQ')

  const trial = async (mode) => {
    const armed = await page.evaluate(async () => {
      const g = window.__capy, G = g.goreme
      const t0 = Date.now()
      while (Date.now() - t0 < 32000) {
        const d = G.fieldDebug()
        const x = d.herdX + 8
        g.capy.body.position.set(x, g.goreme.terrainHeight(x, d.herdZ) + 0.4, d.herdZ)
        g.capy.body.velocity.set(0, 0, 0)
        if (d.herdWait > 5.0) return d
        await new Promise(r => setTimeout(r, 120))
      }
      return null
    })
    if (!armed) return { mode, armed: null }
    if (mode === 'key') await page.keyboard.press('KeyQ')
    else if (mode === 'poke') await page.evaluate(() => { window.__capy.input.honkPressed = true })
    await page.waitForTimeout(450)
    const after = await page.evaluate(() => window.__capy.goreme.fieldDebug())
    return { mode, waitBefore: armed.herdWait, waitAfter: after.herdWait }
  }
  out.key = await trial('key')
  out.poke = await trial('poke')
  out.none = await trial('none')
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=T4-c4b.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
