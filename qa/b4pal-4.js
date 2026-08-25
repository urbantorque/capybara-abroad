async page => {
  const errs = []
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 200)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(7000)
  const out = await page.evaluate(() => {
    const g = window.__capy
    const o = {}
    g.biome.switchTo('palawan')
    const api = g.palawan
    const settle = n => { for (let i = 0; i < n; i++) g.tick(1 / 60, false) }
    settle(60)

    // ---- 1. the locals, and how far they are from divable water ----------
    const L = (g.locals || []).filter(r => r.biome === 'palawan')
    o.locals = L.map(r => ({ id: r.id || r.key || '?', x: +r.x.toFixed(1), z: +r.z.toFixed(1) }))
    const WY = api.waterLevel
    const B = [-80, 80, -145, 70]
    let dive = 0, near40 = 0, near15 = 0, farthest = 0, farAt = null
    const S = 4
    for (let x = B[0]; x <= B[1]; x += S) for (let z = B[2]; z <= B[3]; z += S) {
      if (!api.isOverWater(x, z)) continue
      const h = api.terrainHeight(x, z)
      const wy = api.waterHeightAt ? api.waterHeightAt(x, z) : WY
      if (!(wy - h >= 1.75)) continue
      dive++
      let best = 1e9
      for (const r of L) { const d = Math.hypot(r.x - x, r.z - z); if (d < best) best = d }
      if (best <= 40) near40++
      if (best <= 15) near15++
      if (best > farthest) { farthest = best; farAt = { x, z } }
    }
    o.diveCells = dive
    o.pctWithin40 = +(100 * near40 / Math.max(1, dive)).toFixed(1)
    o.pctWithin15 = +(100 * near15 / Math.max(1, dive)).toFixed(1)
    o.farthest = +farthest.toFixed(1); o.farAt = farAt
    // the named dive spots
    const spots = { reef: api.reef, wreck: api.wreck, clam: api.clam, cathedral: api.cathedral,
                    lagoon: api.lagoon, crack: api.crack, jetty: api.jetty }
    o.spotDist = {}
    for (const k of Object.keys(spots)) {
      const s = spots[k]; if (!s) continue
      let best = 1e9, who = null
      for (const r of L) { const d = Math.hypot(r.x - s.x, r.z - s.z); if (d < best) { best = d; who = r.id || '?' } }
      o.spotDist[k] = { d: +best.toFixed(1), who, terrain: +api.terrainHeight(s.x, s.z).toFixed(2) }
    }

    // ---- 2. surface ladder along the route --------------------------------
    const route = [[0, 46], [0, 40], [6, 26], [6, 16], [0, 8], [-13, 4], [0, -10], [0, -24],
                   [api.crack.x, api.crack.z], [api.lagoon.x, api.lagoon.z],
                   [api.cathedral.x, api.cathedral.z], [api.foot.x, api.foot.z]]
    o.surface = route.map(p => ({ x: p[0], z: p[1],
      pitch: api.surfacePitch ? +api.surfacePitch(p[0], p[1], Math.max(0, api.terrainHeight(p[0], p[1]))).toFixed(2) : null,
      h: +api.terrainHeight(p[0], p[1]).toFixed(2),
      water: !!api.isOverWater(p[0], p[1]) }))

    // ---- 3. stillness, on the seabed --------------------------------------
    function park(x, z, dive) {
      const b = g.capy.body
      b.position.set(x, api.terrainHeight(x, z) + 0.6, z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      g.input.x = 0; g.input.z = 0; g.input.action = !!dive
      for (let i = 0; i < 240; i++) { g.input.action = !!dive; g.tick(1 / 60, false) }
      const a = { x: g.capy.position.x, z: g.capy.position.z, y: g.capy.position.y }
      for (let i = 0; i < 60 * 30; i++) { g.input.action = !!dive; g.tick(1 / 60, false) }
      const c = g.capy.position
      g.input.action = false
      return { moved: +Math.hypot(c.x - a.x, c.z - a.z).toFixed(2), fell: +(c.y - a.y).toFixed(2),
               depth: +(g.capy.depth || 0).toFixed(2), loaf: +(g.capy.loaf || 0).toFixed(2),
               vel: +Math.hypot(g.capy.body.velocity.x, g.capy.body.velocity.z).toFixed(3) }
    }
    o.stillSeabed = park(api.reef.x, api.reef.z, true)
    o.stillBeach = park(0, 46, false)
    o.stillSand = park(-13, 40, false)

    o.lastError = g.state.lastError ? String(g.state.lastError).slice(0, 200) : null
    return o
  })
  out.pageErrors = errs.slice(0, 6)
  await page.evaluate(async d => {
    await fetch('/shot?name=b4pal-4.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(d)))) })
  }, out)
}
