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
      let car = null
      for (const bd of g.world.bodies) {
        if (bd.type === 4 && bd.shapes.length === 2 && Math.abs(bd.position.x - 10.5) < 0.6) car = bd
      }
      const sx = b.position.x, sz = b.position.z
      let px = sx, pz = sz, carPZ = car ? car.position.z : 0
      const rows = []
      let pushed = 0
      for (let i = 0; i < 60 * 60; i++) {
        g.tick(1 / 60, false)
        const d = Math.hypot(b.position.x - px, b.position.z - pz)
        const carDZ = car ? car.position.z - carPZ : 0
        // a PUSH: the animal moved and the float moved the same way in the same frame
        if (d > 0.02 && Math.abs(carDZ) > 0.005) {
          pushed++
          if (rows.length < 10 && (rows.length < 4 || i % 120 === 0)) {
            const dir = Math.sign(carDZ)
            rows.push({
              t: +(i / 60).toFixed(2), d: +d.toFixed(3), carDZ: +carDZ.toFixed(4),
              capy: [+b.position.x.toFixed(2), +b.position.y.toFixed(2), +b.position.z.toFixed(2)],
              carZ: +car.position.z.toFixed(2),
              dx: +Math.abs(b.position.x - car.position.x).toFixed(2),
              ahead: +((b.position.z - car.position.z) * dir).toFixed(2),
              dy: +(b.position.y - car.position.y).toFixed(2)
            })
          }
        }
        px = b.position.x; pz = b.position.z; carPZ = car ? car.position.z : 0
      }
      R.runs.push({
        lead, drift: +Math.hypot(b.position.x - sx, b.position.z - sz).toFixed(3),
        end: [+b.position.x.toFixed(2), +b.position.z.toFixed(2)],
        pushFrames: pushed, rows
      })
    }
    R.err = g.state.lastError || null
    return R
  })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b8-drift7.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
