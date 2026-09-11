async page => {
  // m10-wade.js — IS THERE A WADING BAND AT ALL?
  //
  // The walk-in test at Manly measured `wet` 0 at every footfall, and the
  // reason is arithmetic rather than a bug: `capySWIM_ENTER` is 0.70 from the
  // BODY CENTRE and the foot is 0.34 below it, so the animal is swimming — and
  // the footfall block skipped entirely — before the foot is 36 cm under. If
  // the ground drops away faster than that at the waterline, there is no state
  // in which the animal walks on submerged ground, and the term is correct and
  // unreachable.
  //
  // So ask the question directly, of the geometry, in every chapter with water
  // in it: over a grid, how many standable points are BOTH over water AND
  // shallow enough to walk on? A count is the answer; a walk is a sample of it.
  const out = { rows: [] }
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6500)
  await page.evaluate(() => {
    const all = Array.prototype.slice.call(document.querySelectorAll('.capyui-go'))
    const b = all.filter(function (e) { return !e.classList.contains('alt') })[0] || all[0]
    if (b) b.click()
  })
  await page.waitForTimeout(2500)
  out.started = await page.evaluate(() => window.__capy.state.started)
  const list = ['sydney', 'quay', 'kyoto', 'rio', 'iceland', 'venice', 'palawan',
                'manly', 'pantanal', 'cave', 'antarctic', 'monaco']
  for (const b of list) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(7000)
    out.rows.push(await page.evaluate(() => {
      const g = window.__capy
      const env = (g.biome.current === 'sydney' ? g.env : g[g.biome.current]) || null
      if (!env || typeof env.isOverWater !== 'function') return { cur: g.biome.current, api: false }
      const th = typeof env.terrainHeight === 'function' ? env.terrainHeight : null
      const p = g.capy.position
      // capyWaterY is waterYAt(env, x, z, -0.5) — the same default the animal uses
      const wy = function (x, z) {
        if (typeof env.waterYAt === 'function') return env.waterYAt(x, z)
        if (typeof env.waterLevel === 'function') return env.waterLevel()
        if (typeof env.waterY === 'function') return env.waterY()
        return -0.5
      }
      let over = 0, wade = 0, n = 0, best = -9
      // 121 x 121 m round the animal, every 2 m
      for (let dx = -60; dx <= 60; dx += 2) {
        for (let dz = -60; dz <= 60; dz += 2) {
          const x = p.x + dx, z = p.z + dz
          n++
          if (!env.isOverWater(x, z)) continue
          over++
          const gy = th ? th(x, z) : 0
          if (!(gy === gy)) continue
          const w = wy(x, z)
          // the animal stands here if the BODY CENTRE clears the swim line
          const body = gy + 0.34
          if (body >= w + 0.70) { wade++; if (w - gy > best) best = +(w - gy).toFixed(2) }
        }
      }
      return { cur: g.biome.current, api: true, n: n, over: over, wade: wade,
               pct: +(100 * wade / Math.max(1, over)).toFixed(1), deepest: best,
               terrain: !!th }
    }))
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=m10-wade.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
