async page => {
  await page.reload()
  await page.waitForTimeout(6000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const out = await page.evaluate(() => {
    const g = window.__capy
    const R = { runs: [] }
    // Four float PHASES. switchTo the same biome is a no-op, so a bare loop
    // measures run 1's leftover state three more times; bounce through quay to
    // force a rebuild, then wind the world on by `lead` seconds before parking.
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
      let peak = 0
      for (let i = 0; i < 60 * 60; i++) {
        g.tick(1 / 60, false)
        const d = Math.hypot(b.position.x - sx, b.position.z - sz)
        if (d > peak) peak = d
      }
      R.runs.push({
        lead, biome: g.biome.current,
        drift: +Math.hypot(b.position.x - sx, b.position.z - sz).toFixed(3),
        peak: +peak.toFixed(3)
      })
    }
    R.err = g.state.lastError || null
    return R
  })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b8-drift60.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
