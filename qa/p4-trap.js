async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const out = {}
  const runs = [
    // out of the ocean pool, three ways
    ['pool-out-N', 'manly', 71, 15,   71, 30],
    ['pool-out-S', 'manly', 71, 15,   71, 2],
    ['pool-steps', 'manly', 71, 15,   62.2, 26],
    // to the tether peg, coming round the envelope from the east
    ['tether-E',   'goreme', -6, -14,  -17, -10.4],
    ['tether-S',   'goreme', -17, -24, -17, -10.4],
  ]
  for (const r of runs) {
    out[r[0]] = await page.evaluate(async (R) => {
      const g = window.__capy
      if (g.biome.current !== R[1]) { g.biome.switchTo(R[1]); await new Promise(s=>setTimeout(s,600)) }
      const b = g.capy.body, api = g[R[1]]
      const y0 = Math.max(api.terrainHeight(R[2], R[3]), (api.waterLevel||0)) + 0.6
      b.position.set(R[2], y0, R[3]); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i=0;i<60;i++) g.tick(1/60,false)
      const down = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }))
      const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }))
      let held = new Set(), best = 1e9, maxY = -99
      for (let i = 0; i < 2700; i++) {
        const dx = R[4] - b.position.x, dz = R[5] - b.position.z
        const d = Math.hypot(dx, dz)
        if (d < best) best = d
        if (b.position.y > maxY) maxY = b.position.y
        if (d < 2.0) break
        if (i % 6 === 0) {
          const yaw = g.input.camYaw || 0
          const fx = -Math.sin(yaw), fz = -Math.cos(yaw)
          const rx = Math.cos(yaw), rz = -Math.sin(yaw)
          const fwd = (dx*fx + dz*fz)/d, rgt = (dx*rx + dz*rz)/d
          const want = new Set()
          if (fwd > 0.25) want.add('KeyW'); else if (fwd < -0.25) want.add('KeyS')
          if (rgt > 0.25) want.add('KeyD'); else if (rgt < -0.25) want.add('KeyA')
          // and it jumps, because a player would
          if (i % 42 === 0) want.add('Space')
          for (const k of held) if (!want.has(k)) up(k)
          for (const k of want) if (!held.has(k)) down(k)
          held = want
        }
        g.tick(1/60, false)
      }
      for (const k of held) up(k)
      return { arrived: best < 2.0, closest: +best.toFixed(2), maxY: +maxY.toFixed(2),
               end: [+b.position.x.toFixed(1), +b.position.y.toFixed(2), +b.position.z.toFixed(1)] }
    }, r)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=p4trap.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
