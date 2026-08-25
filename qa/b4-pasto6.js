async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(1800)
  const out = await page.evaluate(() => {
    const g = window.__capy
    const R = {}
    const park = () => {
      g.biome.switchTo('pasto')
      const sp = g.biome.spawnOf('pasto'), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      g.input.x = 0; g.input.z = 0; g.input.action = false; g.input.run = false
      for (let i = 0; i < 60; i++) g.tick(1 / 60, false)
      return [b.position.x, b.position.z]
    }
    const soak = (secs) => {
      const b = g.capy.body
      const s0 = [b.position.x, b.position.z]
      for (let i = 0; i < 60 * secs; i++) g.tick(1 / 60, false)
      return +Math.hypot(b.position.x - s0[0], b.position.z - s0[1]).toFixed(2)
    }
    // ---- A: as shipped -----------------------------------------------------
    park(); R.A_normal = soak(60)

    // ---- B: the biome's own update silenced --------------------------------
    const api = g.pasto
    if (api && typeof api.update === 'function') {
      const real = api.update
      api.update = function () {}
      park(); R.B_noBiomeUpdate = soak(60)
      api.update = real
    } else R.B_noBiomeUpdate = 'no api.update'

    // ---- C: every non-ground body removed from the world -------------------
    {
      const b = g.capy.body
      const kept = []
      const removed = []
      for (const bd of g.world.bodies.slice()) {
        if (bd === b) continue
        // keep only the big static ground/heightfield bodies
        const isGround = bd.shapes.some(sh => sh.type === 1 || sh.type === 16 || sh.type === 32)
        if (!isGround) { removed.push(bd); g.world.removeBody(bd) } else kept.push(bd)
      }
      R.removed = removed.length; R.kept = kept.length
      park(); R.C_bodiesGone = soak(60)
      for (const bd of removed) g.world.addBody(bd)
    }
    R.err = g.state.lastError || null
    return R
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=b4-pasto6.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
