async page => {
  const names = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland',
                 'sahara', 'drift', 'venice', 'kowloon', 'palawan', 'goreme',
                 'manly', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi']
  const started = await page.evaluate(() => !!(window.__capy && window.__capy.state.started))
  const rows = []
  for (const n of names) {
    await page.evaluate((name) => window.__capy.hud.cross(name), n)
    await page.waitForTimeout(7000)
    const legs = []
    for (const th of [0, 90, 180, 270]) {
      const r = await page.evaluate(async ({ name, th }) => {
        const g = window.__capy
        const sleep = ms => new Promise(r => setTimeout(r, ms))
        const cb = g.capy.body, sp = g.biome.spawnOf(name)
        const down = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }))
        const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }))
        const api = name === 'sydney' ? g.env : g[name]
        const ground = (x, z) => (api && typeof api.terrainHeight === 'function') ? api.terrainHeight(x, z) : NaN
        cb.position.set(sp.x, sp.y + 0.3, sp.z); cb.velocity.set(0, 0, 0); cb.angularVelocity.set(0, 0, 0)
        cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position)
        await sleep(600)
        const rad = th * Math.PI / 180
        const dx = Math.sin(rad), dz = Math.cos(rad)
        const held = new Set()
        const want = new Set()
        const steer = () => {
          const cy = Math.cos(g.input.camYaw), sy = Math.sin(g.input.camYaw)
          const ix = dx * cy - dz * sy, iz = dx * sy + dz * cy
          want.clear()
          if (ix < -0.3) want.add('KeyA'); if (ix > 0.3) want.add('KeyD')
          if (iz < -0.3) want.add('KeyW'); if (iz > 0.3) want.add('KeyS')
          for (const k of held) if (!want.has(k)) { up(k); held.delete(k) }
          for (const k of want) if (!held.has(k)) { down(k); held.add(k) }
        }
        down('ShiftLeft')
        let minUnder = 1e9, minY = 1e9, nan = 0, samples = 0, maxSpeed = 0, worstAt = null, belowN = 0
        const t0 = performance.now()
        let x0 = cb.position.x, z0 = cb.position.z
        let stillN = 0, lx = x0, lz = z0
        while (performance.now() - t0 < 6000) {
          steer()
          await sleep(120)
          const p = g.capy.position, v = cb.velocity
          if ([p.x, p.y, p.z, v.x, v.y, v.z].some(q => q !== q)) { nan++; continue }
          samples++
          const gy = ground(p.x, p.z)
          if (gy === gy) {
            const under = p.y - gy
            if (under < minUnder) { minUnder = under; worstAt = [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1), +gy.toFixed(1)] }
            if (under < -0.6) belowN++
          }
          if (p.y < minY) minY = p.y
          const s = Math.hypot(v.x, v.z); if (s > maxSpeed) maxSpeed = s
          if (Math.hypot(p.x - lx, p.z - lz) < 0.02) stillN++
          lx = p.x; lz = p.z
        }
        for (const k of held) up(k)
        up('ShiftLeft')
        const p = g.capy.position
        return { th, dist: +Math.hypot(p.x - x0, p.z - z0).toFixed(1), minUnder: minUnder === 1e9 ? 'n/a' : +minUnder.toFixed(2),
          belowN, minY: +minY.toFixed(1), nan, samples, stillN, maxSpeed: +maxSpeed.toFixed(1), worstAt,
          end: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)], stuck: !!(g.state.stuckSaves), inWater: !!g.capy.inWater,
          carried: !!g.capy.carriedBy, lastError: g.state.lastError || null, biome: g.biome.current, started: g.state.started }
      }, { name: n, th })
      legs.push(r)
    }
    rows.push({ name: n, legs })
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l6r-qa-route.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, { started, rows })
}
