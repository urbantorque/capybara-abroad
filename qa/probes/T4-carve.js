async page => {
  await page.reload()
  await page.waitForTimeout(5200)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(2600)
  const started = await page.evaluate(() => !!window.__capy.state.started)
  const out = { started }
  await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('manly')
    const sp = g.biome.spawnOf('manly')
    g.capy.body.position.set(sp.x, sp.y, sp.z)
    await new Promise(r => setTimeout(r, 2500))
  })
  // Drop the animal out the back and let the sea bring it in, with and
  // without a held stick. Three runs each so a single set does not decide it.
  const run = async (hold, carveOn) => {
    const res = []
    for (let k = 0; k < 3; k++) {
      await page.evaluate(async o => {
        const g = window.__capy
        g.state.noCarve = !o.carveOn
        g.capy.body.position.set(-6 + o.k * 4, 1.2, -40)
        g.capy.body.velocity.set(0, 0, 0)
        await new Promise(r => setTimeout(r, 500))
      }, { carveOn, k })
      if (hold) await page.keyboard.down('KeyD')
      // ride until the counter stops moving
      const r = await page.evaluate(async () => {
        const g = window.__capy, m = g.manly
        let best = 0, bestCarve = 0
        const t0 = Date.now()
        while (Date.now() - t0 < 26000) {
          await new Promise(r2 => setTimeout(r2, 200))
          const d = m.surfDebug()
          if (d.rideDist > best) best = d.rideDist
          if (Math.abs(d.carve) > bestCarve) bestCarve = Math.abs(d.carve)
        }
        return { best: Math.round(best * 100) / 100, peakCarve: Math.round(bestCarve * 100) / 100,
                 d: m.surfDebug() }
      })
      if (hold) await page.keyboard.up('KeyD')
      res.push(r)
    }
    return res
  }
  out.stickOn  = await run(true, true)
  out.stickOff = await run(false, true)
  out.cut      = await run(true, false)
  await page.evaluate(() => { window.__capy.state.noCarve = false })
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=T4-carve.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
