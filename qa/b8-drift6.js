async page => {
  await page.reload()
  await page.waitForTimeout(6000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const out = await page.evaluate(() => {
    const g = window.__capy
    const R = { runs: [] }
    for (const lead of [0, 4]) {
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
      // the float: kinematic, two boxes, parked on the x = 10.5 line
      let car = null
      for (const bd of g.world.bodies) {
        if (bd.type === 4 && bd.shapes.length === 2 && Math.abs(bd.position.x - 10.5) < 0.6) car = bd
      }
      const sx = b.position.x, sz = b.position.z
      let px = sx, pz = sz
      const rows = []
      for (let i = 0; i < 60 * 60; i++) {
        g.tick(1 / 60, false)
        const d = Math.hypot(b.position.x - px, b.position.z - pz)
        if (d > 0.015 && (rows.length < 8 || i % 240 === 0) && rows.length < 16) {
          const touchCar = car && g.world.contacts.some(c => (c.bi === b && c.bj === car) || (c.bj === b && c.bi === car))
          const others = []
          for (const c of g.world.contacts) {
            const o = c.bi === b ? c.bj : (c.bj === b ? c.bi : null)
            if (!o || o === car) continue
            others.push(o.type + ':' + o.mass + ':' + o.shapes.map(x => x.type).join('/') +
                        '@' + o.position.x.toFixed(1) + ',' + o.position.y.toFixed(1) + ',' + o.position.z.toFixed(1))
          }
          rows.push({
            t: +(i / 60).toFixed(2), d: +d.toFixed(3),
            capy: [+b.position.x.toFixed(2), +b.position.y.toFixed(2), +b.position.z.toFixed(2)],
            car: car ? [+car.position.x.toFixed(2), +car.position.z.toFixed(2)] : null,
            carV: car ? +car.velocity.z.toFixed(2) : null,
            touchCar: !!touchCar,
            others: others.slice(0, 3)
          })
        }
        px = b.position.x; pz = b.position.z
      }
      R.runs.push({
        lead, hasCar: !!car,
        drift: +Math.hypot(b.position.x - sx, b.position.z - sz).toFixed(3),
        end: [+b.position.x.toFixed(2), +b.position.z.toFixed(2)],
        rows
      })
    }
    R.err = g.state.lastError || null
    return R
  })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b8-drift6.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
