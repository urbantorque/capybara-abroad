async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const out = {}
  // name, biome, from, to  — a driven walk, closed loop on camYaw
  const runs = [
    ['corso-EW',  'manly',   -56, 45,   52, 45],
    ['corso-NS',  'manly',    -12, 56,  -12, 33],
    ['prom-EW',   'manly',    -50, 42,   50, 42],
    ['point',     'manly',     58, 12,   86, -14],
    ['pal-beach', 'palawan',  -40, 54,   44, 50],
    ['pal-jetty', 'palawan',    0, 44,    6, 16],
    ['gor-tether','goreme',    -6, 12,  -17, -10.4],
    ['gor-plaza', 'goreme',    -14, 40,   10, 26],
  ]
  for (const r of runs) {
    out[r[0]] = await page.evaluate(async (R) => {
      const g = window.__capy
      if (g.biome.current !== R[1]) { g.biome.switchTo(R[1]); await new Promise(s=>setTimeout(s,500)) }
      const b = g.capy.body, api = g[R[1]]
      const y0 = api.terrainHeight(R[2], R[3]) + 1.2
      b.position.set(R[2], y0, R[3]); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      const down = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }))
      const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }))
      let held = null
      let stuck = 0, maxStuck = 0, best = 1e9
      let px = b.position.x, pz = b.position.z
      for (let i = 0; i < 2400; i++) {
        const dx = R[4] - b.position.x, dz = R[5] - b.position.z
        const d = Math.hypot(dx, dz)
        if (d < best) best = d
        if (d < 2.0) break
        // camera-relative WASD, recomputed every 6 frames
        if (i % 6 === 0) {
          const yaw = g.input.camYaw || 0
          const fx = -Math.sin(yaw), fz = -Math.cos(yaw)
          const rx = Math.cos(yaw), rz = -Math.sin(yaw)
          const fwd = (dx*fx + dz*fz) / d, rgt = (dx*rx + dz*rz) / d
          const want = new Set()
          if (fwd > 0.3) want.add('KeyW'); else if (fwd < -0.3) want.add('KeyS')
          if (rgt > 0.3) want.add('KeyD'); else if (rgt < -0.3) want.add('KeyA')
          if (held) for (const k of held) if (!want.has(k)) up(k)
          for (const k of want) if (!held || !held.has(k)) down(k)
          held = want
        }
        g.tick(1/60, false)
        const moved = Math.hypot(b.position.x - px, b.position.z - pz)
        if (moved < 0.004) { stuck++; if (stuck > maxStuck) maxStuck = stuck } else stuck = 0
        px = b.position.x; pz = b.position.z
      }
      if (held) for (const k of held) up(k)
      return { arrived: best < 2.0, closest: +best.toFixed(2), maxStuckFrames: maxStuck,
               end: [+b.position.x.toFixed(1), +b.position.y.toFixed(1), +b.position.z.toFixed(1)] }
    }, r)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=p4walk.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
