async page => {
  const ALL = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift',
               'venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic',
               'monaco','hanoi']
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(3000)

  const rows = []
  for (const name of ALL) {
    rows.push(await page.evaluate((n) => {
      const g = window.__capy
      if (!g.biome.isActive(n)) g.biome.switchTo(n)
      const inp = g.input
      const D = 1 / 60
      const b = g.capy.body
      const api = n === 'sydney' ? g.env : g[n]
      const sp = g.biome.spawnOf(n)
      let sx = 0, sz = 0, sact = false, srun = false
      function T (k) {
        for (let i = 0; i < k; i++) {
          inp.x = sx; inp.z = sz; inp.run = srun; inp.camYaw = 0
          inp.action = sact; inp.actionPressed = false
          inp.jump = false; inp.jumpPressed = false
          g.tick(D, false)
        }
      }
      // THE REAL PATH, NOT THE PUBLISHED HOOK. qa/mv-verbs.js asked
      // `api.climbHold` and sixteen chapters do not publish it — but
      // capybara.js falls back to a generic ray probe against the static world
      // (see A WALL IS A WALL, IN EVERY CHAPTER), so the hook is not the verb.
      // This drives the animal at real geometry and watches capy.climbing.
      const hits = []
      let tried = 0
      for (let a = 0; a < 24 && hits.length < 4; a++) {
        const th = a * Math.PI / 12
        const y0 = (api && api.terrainHeight) ? api.terrainHeight(sp.x, sp.z) : 0
        b.position.set(sp.x, y0 + 0.6, sp.z); b.velocity.set(0, 0, 0)
        b.angularVelocity.set(0, 0, 0)
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
        sx = Math.sin(th); sz = Math.cos(th); sact = false; srun = false
        T(90)                                   // walk out until something stops us
        const spd = Math.hypot(b.velocity.x, b.velocity.z)
        if (spd > 1.2) { continue }             // nothing in the way on this bearing
        tried++
        // press into it and hold the grab key
        const yBefore = b.position.y
        sact = true
        let climbedFrames = 0
        for (let i = 0; i < 150; i++) { T(1); if (g.capy.climbing) climbedFrames++ }
        const rise = b.position.y - yBefore
        sact = false
        if (climbedFrames > 5) {
          hits.push({ bearing: +(th * 57.3).toFixed(0),
                      frames: climbedFrames, rise: +rise.toFixed(2) })
        }
      }
      sx = 0; sz = 0; sact = false; T(20)
      return { biome: g.biome.current, hook: !!(api && api.climbHold),
               blocked: tried, climbed: hits.length, hits: hits }
    }, name))
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=mv-climb.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, rows)
}
