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
    const sp = g.biome.spawnOf('pasto')
    b.position.set(sp.x + 9, sp.y, sp.z + 9)
    b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position)
    b.interpolatedPosition.copy(b.position)
    g.input.x = 0; g.input.z = 0; g.input.action = false; g.input.run = false
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false)
    R.biome = g.biome.current
    R.start = [+b.position.x.toFixed(3), +b.position.y.toFixed(3), +b.position.z.toFixed(3)]

    // ---- who writes the velocity? ------------------------------------------
    let inStep = false
    const realStep = g.world.step
    g.world.step = function () {
      inStep = true
      try { return realStep.apply(this, arguments) } finally { inStep = false }
    }
    const tally = {}
    const sig = () => {
      const st = (new Error()).stack || ''
      const lines = st.split('\n').slice(1)
      const keep = []
      for (const L of lines) {
        if (L.indexOf('jsdelivr') >= 0) continue
        if (L.indexOf('cannon') >= 0) continue
        if (L.indexOf('Object.set') >= 0) continue
        if (L.indexOf('at set ') >= 0) continue
        keep.push(L.trim().replace('http://localhost:5188/', ''))
        if (keep.length >= 4) break
      }
      return keep.join(' <- ') || '(unknown)'
    }
    const wrap = (vec, tag) => new Proxy(vec, {
      set (t, p, v) {
        if (!inStep && (p === 'x' || p === 'y' || p === 'z')) {
          const k = tag + ' | ' + sig()
          const e = tally[k] || (tally[k] = { n: 0, props: {}, vals: [] })
          e.n++
          e.props[p] = (e.props[p] || 0) + 1
          if (e.vals.length < 4) e.vals.push(p + '=' + (+v).toFixed(4))
        }
        t[p] = v
        return true
      }
    })
    b.velocity = wrap(b.velocity, 'vel')

    const s0 = [b.position.x, b.position.z]
    const samples = []
    for (let i = 0; i < 60 * 20; i++) {
      g.tick(1 / 60, false)
      if (i % 120 === 0) samples.push({
        t: +(i / 60).toFixed(1),
        p: [+b.position.x.toFixed(3), +b.position.z.toFixed(3)],
        v: [+b.velocity.x.toFixed(4), +b.velocity.z.toFixed(4)],
        frame: g.capy.frame ? 'yes' : 'no'
      })
    }
    R.moved20s = +Math.hypot(b.position.x - s0[0], b.position.z - s0[1]).toFixed(3)
    R.end = [+b.position.x.toFixed(3), +b.position.z.toFixed(3)]
    R.samples = samples
    R.writers = Object.keys(tally)
      .map(k => ({ k, n: tally[k].n, props: tally[k].props, vals: tally[k].vals }))
      .sort((a, c) => c.n - a.n)
      .slice(0, 14)
    R.err = g.state.lastError || null
    return R
  })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b8-drift1.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
