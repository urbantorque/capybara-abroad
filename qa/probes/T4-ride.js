async page => {
  await page.reload()
  await page.waitForTimeout(5200)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(2600)
  const started = await page.evaluate(() => !!window.__capy.state.started)
  await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('manly')
    const sp = g.biome.spawnOf('manly')
    g.capy.body.position.set(sp.x, sp.y, sp.z)
    await new Promise(r => setTimeout(r, 2500))
  })
  const out = { started, runs: [] }
  // Six runs: hold D / hold nothing, each with the term on, plus the cut.
  const plan = [['D', true], ['none', true], ['D', false], ['none', false],
                ['D', true], ['none', true]]
  for (let i = 0; i < plan.length; i++) {
    const [key, on] = plan[i]
    // put it out the back and WAIT for a wave to be under it before counting
    await page.evaluate(async o => {
      const g = window.__capy
      g.state.noCarve = !o.on
      g.capy.body.position.set(0, 1.0, 14)
      g.capy.body.velocity.set(0, 0, 0)
      await new Promise(r => setTimeout(r, 700))
    }, { on })
    if (key === 'D') await page.keyboard.down('KeyD')
    const r = await page.evaluate(async () => {
      const g = window.__capy, m = g.manly
      let best = 0, pk = 0, cd = 0
      const t0 = Date.now()
      while (Date.now() - t0 < 30000) {
        await new Promise(r2 => setTimeout(r2, 150))
        const d = m.surfDebug()
        if (d.rideDist > best) { best = d.rideDist; cd = d.carveDist }
        if (Math.abs(d.carve) > pk) pk = Math.abs(d.carve)
      }
      return { best: Math.round(best * 100) / 100, peakCarve: Math.round(pk * 100) / 100,
               carveDist: Math.round(cd * 100) / 100 }
    })
    if (key === 'D') await page.keyboard.up('KeyD')
    out.runs.push({ key, on, ...r })
  }
  await page.evaluate(() => { window.__capy.state.noCarve = false })
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=T4-ride.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
