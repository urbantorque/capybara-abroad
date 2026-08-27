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
    // ---- pick the spots first, cheaply -----------------------------------
    const plan = await page.evaluate((n) => {
      const g = window.__capy
      if (!g.biome.isActive(n)) g.biome.switchTo(n)
      for (let i = 0; i < 60; i++) g.tick(1 / 60, false)
      const api = n === 'sydney' ? g.env : g[n]
      const sp = g.biome.spawnOf(n)
      let sx = sp.x, sz = sp.z, worst = -1
      if (api && api.slopeAt) {
        for (let a = 0; a < 40; a++) {
          const r = 8 + (a % 5) * 12, th = a * 0.71
          const x = sp.x + Math.cos(th) * r, z = sp.z + Math.sin(th) * r
          if (api.isOverWater && api.isOverWater(x, z)) continue
          const s = Math.abs(api.slopeAt(x, z) || 0)
          if (s > worst && s < 1.4) { worst = s; sx = x; sz = z }
        }
      }
      return { biome: g.biome.current, slope: +Math.max(0, worst).toFixed(3),
               spots: [{ k: 'spawn', x: sp.x, z: sp.z },
                       { k: '+9+9', x: sp.x + 9, z: sp.z + 9 },
                       { k: 'steep', x: sx, z: sz }] }
    }, name)

    // ---- then one evaluate per spot, or the context is destroyed ----------
    const got = []
    for (const s of plan.spots) {
      got.push(await page.evaluate((arg) => {
        const g = window.__capy
        const inp = g.input
        const D = 1 / 60
        const b = g.capy.body
        const api = arg.n === 'sydney' ? g.env : g[arg.n]
        function T (k) {
          for (let i = 0; i < k; i++) {
            inp.x = 0; inp.z = 0; inp.run = false; inp.camYaw = 0
            inp.jump = false; inp.jumpPressed = false; inp.action = false
            g.tick(D, false)
          }
        }
        const y = (api && api.terrainHeight) ? api.terrainHeight(arg.x, arg.z) : 0
        b.position.set(arg.x, y + 0.5, arg.z); b.velocity.set(0, 0, 0)
        b.angularVelocity.set(0, 0, 0)
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
        T(120)
        const x0 = b.position.x, z0 = b.position.z
        T(3600)                                  // sixty seconds, no input at all
        return { k: arg.k,
                 d: +Math.hypot(b.position.x - x0, b.position.z - z0).toFixed(2),
                 v: +Math.hypot(b.velocity.x, b.velocity.z).toFixed(3) }
      }, { n: name, k: s.k, x: s.x, z: s.z }))
    }
    rows.push({ biome: plan.biome, slope: plan.slope, spots: got })
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=mv-park.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, rows)
}
