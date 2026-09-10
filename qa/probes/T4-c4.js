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
  const out = { runs: [] }
  for (const wheek of [true, false]) {
    // park beside the herd and wait until it is standing at an end
    const armed = await page.evaluate(async () => {
      const g = window.__capy, G = g.goreme
      const t0 = Date.now()
      while (Date.now() - t0 < 30000) {
        const d = G.fieldDebug()
        g.capy.body.position.set(d.herdX + 8, g.goreme.terrainHeight(d.herdX + 8, d.herdZ) + 0.4, d.herdZ)
        g.capy.body.velocity.set(0, 0, 0)
        if (d.herdWait > 4.0) return d
        await new Promise(r => setTimeout(r, 150))
      }
      return null
    })
    if (!armed) { out.runs.push({ wheek, armed: null }); continue }
    if (wheek) await page.keyboard.press('KeyQ')
    await page.waitForTimeout(600)
    const after = await page.evaluate(() => window.__capy.goreme.fieldDebug())
    // and how long until they actually move
    const moved = await page.evaluate(async z0 => {
      const G = window.__capy.goreme
      const t0 = Date.now()
      while (Date.now() - t0 < 12000) {
        await new Promise(r => setTimeout(r, 100))
        if (Math.abs(G.fieldDebug().herdZ - z0) > 3) return (Date.now() - t0) / 1000
      }
      return -1
    }, armed.herdZ)
    out.runs.push({ wheek, waitBefore: armed.herdWait, waitAfter: after.herdWait, movedAfterS: moved })
  }
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=T4-c4.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
