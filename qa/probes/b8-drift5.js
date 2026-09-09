async page => {
  await page.reload()
  await page.waitForTimeout(6000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const out = await page.evaluate(() => {
    const g = window.__capy
    const R = { runs: [] }
    for (const lead of [0, 4, 8, 13]) {
      g.biome.switchTo('quay')
      for (let i = 0; i < 30; i++) g.tick(1 / 60, false)
      g.biome.switchTo('pasto')
      g.input.x = 0; g.input.z = 0; g.input.action = false; g.input.run = false
      for (let i = 0; i < 60 + 60 * lead; i++) g.tick(1 / 60, false)
      const b = g.capy.body
      const sp = g.biome.spawnOf('pasto')
      b.position.set(sp.x + 9, sp.y, sp.z + 9)
      b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position)
      b.interpolatedPosition.copy(b.position)
      for (let i = 0; i < 60; i++) g.tick(1 / 60, false)
      const sx = b.position.x, sz = b.position.z
      let px = sx, pz = sz
      const big = []
      // 12 slices of 5 s: where in the minute does the ground get covered?
      const slice = new Array(12).fill(0)
      for (let i = 0; i < 60 * 60; i++) {
        g.tick(1 / 60, false)
        const dx = b.position.x - px, dz = b.position.z - pz
        const d = Math.hypot(dx, dz)
        slice[Math.min(11, Math.floor(i / 300))] += d
        if (d > 0.05) {
          const cs = []
          for (const c of g.world.contacts) {
            const o = c.bi === b ? c.bj : (c.bj === b ? c.bi : null)
            if (!o) continue
            cs.push(o.type + ':' + o.mass + ':' + o.shapes.map(x => x.type).join('/') +
                    '@' + o.position.x.toFixed(1) + ',' + o.position.y.toFixed(1) + ',' + o.position.z.toFixed(1))
          }
          big.push({ t: +(i / 60).toFixed(2), d: +d.toFixed(3),
                     p: [+b.position.x.toFixed(2), +b.position.y.toFixed(2), +b.position.z.toFixed(2)],
                     v: [+b.velocity.x.toFixed(2), +b.velocity.y.toFixed(2), +b.velocity.z.toFixed(2)],
                     st: g.capy.state || null, frame: g.capy.frame ? 'yes' : 'no',
                     c: cs.slice(0, 3) })
        }
        px = b.position.x; pz = b.position.z
      }
      big.sort((a, c) => c.d - a.d)
      R.runs.push({
        lead, biome: g.biome.current,
        drift: +Math.hypot(b.position.x - sx, b.position.z - sz).toFixed(3),
        end: [+b.position.x.toFixed(2), +b.position.y.toFixed(2), +b.position.z.toFixed(2)],
        nBig: big.length,
        path: slice.map(n => +n.toFixed(2)),
        top: big.slice(0, 4)
      })
    }
    R.err = g.state.lastError || null
    return R
  })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b8-drift5.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
