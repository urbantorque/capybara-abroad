async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(3000)

  const ALL = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland', 'sahara',
               'drift', 'venice', 'kowloon', 'palawan', 'goreme', 'manly', 'pantanal',
               'cave', 'antarctic', 'monaco', 'hanoi']
  const rows = []
  for (const name of ALL) {
    rows.push(await page.evaluate((n) => {
      const g = window.__capy
      if (!g.biome.isActive(n)) g.biome.switchTo(n)
      const b = g.capy.body, inp = g.input, D = 1 / 60
      const api = n === 'sydney' ? g.env : g[n]
      const sp = g.biome.spawnOf(n)
      let sx = 0, sz = 0, srun = false, sjump = false, sedge = false
      function T (k) {
        for (let i = 0; i < k; i++) {
          inp.x = sx; inp.z = sz; inp.run = srun; inp.camYaw = 0
          inp.jump = sjump; inp.jumpPressed = sedge; sedge = false
          g.tick(D, false)
        }
      }
      function place () {
        const y = (api && api.terrainHeight) ? api.terrainHeight(sp.x, sp.z) : 0
        b.position.set(sp.x, y + 0.5, sp.z); b.velocity.set(0, 0, 0)
        b.angularVelocity.set(0, 0, 0)
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      }
      // A sprinting hop, and the PEAK horizontal speed it reaches in the air.
      place(); sx = 1; srun = true; T(200)
      const vIn = Math.hypot(b.velocity.x, b.velocity.z)
      const x0 = b.position.x, z0 = b.position.z
      sjump = true; sedge = true
      let peak = 0, left = false, air = 0
      for (let i = 0; i < 400; i++) {
        T(1)
        peak = Math.max(peak, Math.hypot(b.velocity.x, b.velocity.z))
        if (!g.capy.grounded) { left = true; air += D }
        else if (left && i > 10) break
      }
      sjump = false; sx = 0; srun = false
      const dist = Math.hypot(b.position.x - x0, b.position.z - z0)
      // ...then just drive it about for a bit and see if anything throws.
      for (let s = 0; s < 4; s++) {
        sx = s % 2 ? 1 : -1; sz = s % 3 ? 1 : -1; srun = s % 2 === 0
        if (s === 2) { sjump = true; sedge = true } else sjump = false
        T(90)
      }
      sx = 0; sz = 0; srun = false; sjump = false; T(30)
      return { biome: g.biome.current, vIn: +vIn.toFixed(1), peak: +peak.toFixed(1),
               ratio: +(peak / Math.max(0.1, vIn)).toFixed(2),
               dist: +dist.toFixed(2), air: +air.toFixed(2),
               err: g.state.lastError ? String(g.state.lastError).slice(0, 90) : null }
    }, name))
  }
  await page.evaluate(o => fetch('/shot?name=verify.json', {
    method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))
  }), rows)
}
