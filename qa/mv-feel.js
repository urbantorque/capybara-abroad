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
      const b = g.capy.body
      const inp = g.input
      const D = 1 / 60
      const api = n === 'sydney' ? g.env : g[n]
      const sp = g.biome.spawnOf(n)

      // Stick is re-asserted EVERY tick: systems.js rewrites game.input from the
      // real keyboard at the bottom of its own update, so a value written once
      // survives exactly one frame.
      let sx = 0, sz = 0, srun = false, sjump = false, sjumpEdge = false
      function T (k) {
        for (let i = 0; i < k; i++) {
          inp.x = sx; inp.z = sz; inp.run = srun; inp.camYaw = 0
          inp.jump = sjump; inp.jumpPressed = sjumpEdge; sjumpEdge = false
          g.tick(D, false)
        }
      }
      function place (x, z) {
        const y = (api && api.terrainHeight) ? api.terrainHeight(x, z) : 0
        b.position.set(x, y + 0.5, z); b.velocity.set(0, 0, 0)
        b.angularVelocity.set(0, 0, 0)
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      }
      function spd () { return Math.hypot(b.velocity.x, b.velocity.z) }

      // ---- find a patch of this chapter that is actually flat and dry -------
      let fx = sp.x, fz = sp.z, best = 9
      if (api && api.terrainHeight) {
        for (let a = 0; a < 24; a++) {
          const r = 4 + (a % 4) * 6, th = a * 0.7
          const x = sp.x + Math.cos(th) * r, z = sp.z + Math.sin(th) * r
          if (api.isOverWater && api.isOverWater(x, z)) continue
          const h = api.terrainHeight(x, z)
          const grad = Math.abs(api.terrainHeight(x + 1, z) - h) +
                       Math.abs(api.terrainHeight(x, z + 1) - h)
          if (grad < best) { best = grad; fx = x; fz = z }
        }
      }

      const out = { biome: g.biome.current, grad: +best.toFixed(3) }

      // ---- 1. WALK top speed and time to 90% of it -------------------------
      place(fx, fz); sx = 0; sz = 0; srun = false; T(90)
      sz = -1
      let walkTop = 0
      for (let i = 0; i < 200; i++) { T(1); walkTop = Math.max(walkTop, spd()) }
      out.walkTop = +walkTop.toFixed(2)
      place(fx, fz); sz = 0; T(90)
      sz = -1
      let t90 = -1
      for (let i = 0; i < 200 && t90 < 0; i++) { T(1); if (spd() >= 0.9 * walkTop) t90 = (i + 1) * D }
      out.t90 = +t90.toFixed(3)

      // ---- 2. RUN top speed -------------------------------------------------
      srun = true
      let runTop = 0
      for (let i = 0; i < 200; i++) { T(1); runTop = Math.max(runTop, spd()) }
      out.runTop = +runTop.toFixed(2)
      out.stam = +g.capy.stamina.toFixed(2)

      // ---- 3. BRAKE from a run ---------------------------------------------
      place(fx, fz); sz = -1; srun = true; T(150)
      const vRun = spd()
      sz = 0; sx = 0; srun = false
      let tStop = -1
      for (let i = 0; i < 200 && tStop < 0; i++) { T(1); if (spd() < 0.2) tStop = (i + 1) * D }
      out.vRun = +vRun.toFixed(2)
      out.tStop = +tStop.toFixed(3)

      // ---- 4. REVERSAL ------------------------------------------------------
      place(fx, fz); sz = -1; srun = true; T(150)
      const vB = Math.max(0.5, spd())
      sz = 1
      let tRev = -1, dip = 99
      for (let i = 0; i < 240; i++) {
        T(1)
        const s = spd(); if (s < dip) dip = s
        if (tRev < 0 && b.velocity.z > 0.9 * vB) tRev = (i + 1) * D
      }
      out.tRev = +tRev.toFixed(3)
      out.revDip = +dip.toFixed(2)

      // ---- 5. THE HOP -------------------------------------------------------
      place(fx, fz); sz = 0; sx = 0; srun = false; T(120)
      const y0 = b.position.y
      sjump = true; sjumpEdge = true
      let apex = 0, air = 0, left = false
      for (let i = 0; i < 200; i++) {
        T(1)
        apex = Math.max(apex, b.position.y - y0)
        if (!g.capy.grounded) { left = true; air += D }
        else if (left && i > 10) break
      }
      sjump = false
      out.hopApex = +apex.toFixed(2)
      out.hopAir = +air.toFixed(3)

      // ---- 6. SHORT-HOP: tap, do not hold ----------------------------------
      place(fx, fz); T(120)
      const y1 = b.position.y
      sjump = true; sjumpEdge = true; T(2); sjump = false
      let apex2 = 0
      for (let i = 0; i < 200; i++) { T(1); apex2 = Math.max(apex2, b.position.y - y1); if (i > 12 && g.capy.grounded) break }
      out.tapApex = +apex2.toFixed(2)

      sx = 0; sz = 0; srun = false; sjump = false; T(30)
      return out
    }, name))
  }
  await page.evaluate(async (out) => {
    await fetch('/shot?name=mv-feel.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(out, null, 1)))) })
  }, rows)
}
