async page => {
  await page.reload()
  await page.waitForTimeout(6000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const out = await page.evaluate(() => {
    const g = window.__capy
    const R = {}
    g.biome.switchTo('pasto')
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false)
    const b = g.capy.body
    b.position.set(0, 0.34, 26)
    b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    g.input.x = 0; g.input.z = 0
    for (let i = 0; i < 240; i++) g.tick(1 / 60, false)

    let inStep = false
    const realStep = g.world.step
    g.world.step = function () {
      inStep = true
      try { return realStep.apply(this, arguments) } finally { inStep = false }
    }
    const tally = {}
    const sig = () => {
      const st = (new Error()).stack || ''
      const keep = []
      for (const L of st.split('\n').slice(1)) {
        if (L.indexOf('jsdelivr') >= 0 || L.indexOf('cannon') >= 0 || L.indexOf('anonymous') >= 0) continue
        keep.push(L.trim().replace('http://localhost:5188/', ''))
        if (keep.length >= 3) break
      }
      return keep.join(' <- ') || '(unknown)'
    }
    b.velocity = new Proxy(b.velocity, {
      set (t, p, v) {
        if (p === 'y' && Math.abs(v) > 0.5) {
          const k = (inStep ? 'STEP ' : 'LOOSE ') + sig()
          const e = tally[k] || (tally[k] = { n: 0, vals: [] })
          e.n++
          if (e.vals.length < 4) e.vals.push(+(+v).toFixed(3))
        }
        t[p] = v
        return true
      }
    })
    for (let i = 0; i < 60 * 20; i++) g.tick(1 / 60, false)
    R.writers = Object.keys(tally).map(k => ({ k, n: tally[k].n, vals: tally[k].vals }))
      .sort((a, c) => c.n - a.n).slice(0, 10)
    R.err = g.state.lastError || null
    return R
  })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b8-hop2.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
