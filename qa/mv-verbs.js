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
      for (let i = 0; i < 60; i++) g.tick(1 / 60, false)
      const api = n === 'sydney' ? g.env : g[n]
      const sp = g.biome.spawnOf(n)
      const o = { biome: g.biome.current,
                  has: { slip: !!(api && api.groundSlip), climb: !!(api && api.climbHold),
                         wind: !!(api && api.wind), flow: !!(api && api.flow),
                         carry: !!(api && api.carryFrame), air: (api && typeof api.airControl === 'number') ? api.airControl : null,
                         diveFlag: (api && typeof api.canDive === 'boolean') ? api.canDive : null,
                         localWater: !!(api && api.localWater) } }
      // A 200 m square about the spawn, 41x41 samples.
      const R = 100, N = 41
      let cells = 0, water = 0, deep = 0, slip = 0, steep = 0, climb = 0
      let maxSlip = 0, maxDeep = 0, maxSlope = 0
      const DIVE_MIN = 1.6      // capyDIVE_MIN_D — the measured dive rule
      for (let i = 0; i < N; i++) {
        for (let k = 0; k < N; k++) {
          const x = sp.x - R + (2 * R * i) / (N - 1)
          const z = sp.z - R + (2 * R * k) / (N - 1)
          cells++
          const th = (api && api.terrainHeight) ? api.terrainHeight(x, z) : 0
          const ow = !!(api && api.isOverWater && api.isOverWater(x, z))
          if (ow) {
            water++
            const wy = (api && api.localWater && api.waterHeightAt) ? api.waterHeightAt(x, z)
                     : (api && api.waterHeightAt) ? api.waterHeightAt(x, z) : -0.5
            const d = wy - th
            if (d > maxDeep) maxDeep = d
            if (d >= DIVE_MIN) deep++
          }
          if (api && api.groundSlip) {
            const s = api.groundSlip(x, z) || 0
            if (s > maxSlip) maxSlip = s
            if (s > 0.2) slip++
          }
          if (api && api.slopeAt) {
            const s = Math.abs(api.slopeAt(x, z) || 0)
            if (s > maxSlope) maxSlope = s
            if (s > 0.45) steep++
          }
          if (api && api.climbHold) {
            if (api.climbHold(x, th + 1.2, z)) climb++
          }
        }
      }
      const pc = v => +(100 * v / cells).toFixed(1)
      o.water = pc(water); o.divable = pc(deep); o.slip = pc(slip)
      o.steep = pc(steep); o.climb = pc(climb)
      o.maxSlip = +maxSlip.toFixed(2); o.maxDeep = +maxDeep.toFixed(1)
      o.maxSlope = +maxSlope.toFixed(2)
      return o
    }, name))
  }
  await page.evaluate(async (out) => {
    await fetch('/shot?name=mv-verbs.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(out, null, 1)))) })
  }, rows)
}
