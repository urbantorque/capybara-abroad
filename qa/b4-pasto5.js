async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(1800)
  const out = await page.evaluate(() => {
    const g = window.__capy
    const R = {}
    const run = (banish) => {
      g.biome.switchTo('pasto')
      const sp = g.biome.spawnOf('pasto'), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      g.input.x = 0; g.input.z = 0; g.input.action = false; g.input.run = false
      for (let i = 0; i < 60; i++) g.tick(1 / 60, false)
      const sx = b.position.x, sz = b.position.z
      let minD = 99
      for (let s = 0; s < 60 * 60; s++) {
        if (banish) {
          // LIFT EVERY KINEMATIC BODY OUT OF THE WORLD, every frame, so nothing
          // in the chapter can touch the animal but the ground.
          for (const bd of g.world.bodies) {
            if (bd.type === 4 && bd !== b) { bd.position.y = -400; bd.velocity.set(0, 0, 0) }
          }
        }
        g.tick(1 / 60, false)
        for (const bd of g.world.bodies) {
          if (bd === b || bd.type !== 4) continue
          const d = Math.hypot(bd.position.x - b.position.x, bd.position.z - b.position.z)
          if (d < minD) minD = d
        }
      }
      return { moved: +Math.hypot(b.position.x - sx, b.position.z - sz).toFixed(2),
               minKinD: +minD.toFixed(2),
               vel: +Math.hypot(b.velocity.x, b.velocity.z).toFixed(3) }
    }
    R.withPeople = run(false)
    R.withoutPeople = run(true)
    R.err = g.state.lastError || null
    return R
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=b4-pasto5.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
