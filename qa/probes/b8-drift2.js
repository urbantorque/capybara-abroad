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
    R.start = [+b.position.x.toFixed(3), +b.position.z.toFixed(3)]

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
        if (L.indexOf('anonymous') >= 0) continue
        keep.push(L.trim().replace('http://localhost:5188/', ''))
        if (keep.length >= 4) break
      }
      return keep.join(' <- ') || '(unknown)'
    }
    let cur = null
    const posProxy = new Proxy(b.position, {
      set (t, p, v) {
        if ((p === 'x' || p === 'z') && Math.abs(v - t[p]) > 1e-6) {
          const k = (inStep ? 'STEP ' : 'LOOSE ') + sig()
          const e = tally[k] || (tally[k] = { n: 0, sum: 0, max: 0, vals: [] })
          e.n++
          const d = v - t[p]
          e.sum += Math.abs(d)
          if (Math.abs(d) > Math.abs(e.max)) e.max = +d.toFixed(4)
          if (e.vals.length < 3) e.vals.push(p + ' ' + (+t[p]).toFixed(3) + '->' + (+v).toFixed(3))
          if (cur && Math.abs(d) > 0.02) cur.hits.push({ k: k.slice(0, 150), d: +d.toFixed(3) })
        }
        t[p] = v
        return true
      }
    })
    b.position = posProxy

    const events = []
    let pz = b.position.z, px = b.position.x
    for (let i = 0; i < 60 * 25; i++) {
      cur = { hits: [] }
      g.tick(1 / 60, false)
      const dz = b.position.z - pz, dx = b.position.x - px
      if (Math.hypot(dx, dz) > 0.02 && events.length < 10) {
        events.push({
          t: +(i / 60).toFixed(2),
          d: [+dx.toFixed(3), +dz.toFixed(3)],
          v: [+b.velocity.x.toFixed(3), +b.velocity.z.toFixed(3)],
          st: g.capy.state || null,
          frame: g.capy.frame ? 'yes' : 'no',
          hits: cur.hits.slice(0, 4)
        })
      }
      pz = b.position.z; px = b.position.x
    }
    cur = null
    R.moved = +Math.hypot(b.position.x - 9, b.position.z - 35).toFixed(3)
    R.events = events
    R.writers = Object.keys(tally)
      .map(k => ({ k, n: tally[k].n, sum: +tally[k].sum.toFixed(3), max: tally[k].max, vals: tally[k].vals }))
      .sort((a, c) => c.sum - a.sum)
      .slice(0, 12)
    R.err = g.state.lastError || null
    return R
  })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b8-drift2.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
