async page => {
  await page.reload()
  await page.waitForTimeout(6000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const out = await page.evaluate(() => {
    const g = window.__capy
    const R = {}
    g.biome.switchTo('quay')
    for (let i = 0; i < 30; i++) g.tick(1 / 60, false)
    g.biome.switchTo('pasto')
    g.input.x = 0; g.input.z = 0; g.input.action = false; g.input.run = false
    for (let i = 0; i < 60 + 60 * 13; i++) g.tick(1 / 60, false)
    const b = g.capy.body
    const sp = g.biome.spawnOf('pasto')
    b.position.set(sp.x + 9, sp.y, sp.z + 9)
    b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position)
    b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false)

    const realStep = g.world.step
    let pre = null
    g.world.step = function () {
      pre = [b.velocity.x, b.velocity.y, b.velocity.z]
      return realStep.apply(this, arguments)
    }
    const rows = []
    let px = b.position.x, pz = b.position.z
    for (let i = 0; i < 60 * 60; i++) {
      g.tick(1 / 60, false)
      const dx = b.position.x - px, dz = b.position.z - pz
      if (Math.hypot(dx, dz) > 0.02 && (rows.length < 12) && (i % 17 === 0 || rows.length < 3)) {
        const cs = []
        for (const c of g.world.contacts) {
          const o = c.bi === b ? c.bj : (c.bj === b ? c.bi : null)
          if (!o) continue
          cs.push({ t: o.type, m: o.mass, s: o.shapes.map(x => x.type).join('/'),
                    p: [+o.position.x.toFixed(1), +o.position.y.toFixed(1), +o.position.z.toFixed(1)] })
        }
        rows.push({
          t: +(i / 60).toFixed(2),
          p: [+b.position.x.toFixed(2), +b.position.y.toFixed(2), +b.position.z.toFixed(2)],
          d: [+dx.toFixed(3), +dz.toFixed(3)],
          preV: pre.map(n => +n.toFixed(2)),
          postV: [+b.velocity.x.toFixed(2), +b.velocity.y.toFixed(2), +b.velocity.z.toFixed(2)],
          st: g.capy.state || null, frame: g.capy.frame ? 'yes' : 'no',
          grounded: !!g.capy.grounded,
          contacts: cs.slice(0, 4)
        })
      }
      px = b.position.x; pz = b.position.z
    }
    R.rows = rows
    R.end = [+b.position.x.toFixed(2), +b.position.y.toFixed(2), +b.position.z.toFixed(2)]
    R.err = g.state.lastError || null
    return R
  })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b8-drift4.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
