async page => {
  await page.evaluate(async () => { const g = window.__capy; if (g.biome.current !== 'monaco') { g.hud.cross('monaco'); await new Promise(r => setTimeout(r, 8000)) } })
  const trials = []
  for (let k = 0; k < 4; k++) {
    const r = await page.evaluate(async (k) => {
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
      const g = window.__capy, cb = g.capy.body
      // the fastest kinematic body in the world right now = a car
      let car = null, cv = 0
      for (const b of g.world.bodies) { if (b.type !== 4) continue; const mv = Math.hypot(b.velocity.x, b.velocity.z); if (mv > cv) { cv = mv; car = b } }
      if (!car) return { noCar: true }
      const vx = car.velocity.x / cv, vz = car.velocity.z / cv
      const ahead = 10 + k * 3
      const x = car.position.x + vx * ahead, z = car.position.z + vz * ahead
      const gy = g.monaco && g.monaco.terrainHeight ? g.monaco.terrainHeight(x, z) : car.position.y
      cb.wakeUp(); cb.position.set(x, Math.max(gy, car.position.y) + 0.6, z); cb.velocity.set(0, 0, 0); cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position)
      const p0 = [x, z]
      const saves0 = g.state.solverSaves
      let maxSpd = 0, hitAt = -1, maxY = -1e9, pills = new Set(), airT = 0
      const t0 = performance.now()
      while (performance.now() - t0 < 4000) {
        await sleep(16)
        const v = cb.velocity, p = cb.position
        const s = Math.hypot(v.x, v.y, v.z)
        if (s > maxSpd) maxSpd = s
        if (s > 15 && hitAt < 0) hitAt = +((performance.now() - t0) / 1000).toFixed(2)
        if (p.y > maxY) maxY = p.y
        for (const el of document.querySelectorAll('.capyui-toast')) { const t = el.textContent.trim(); if (t) pills.add(t.slice(0, 80)) }
      }
      const p = cb.position
      return { carV: +cv.toFixed(1), carY: +car.position.y.toFixed(1), carShape: car.shapes.map(s => s.constructor.name).join(','), placedAhead: ahead, hitAt, maxSpd: +maxSpd.toFixed(1), maxY: +maxY.toFixed(1), flew: +Math.hypot(p.x - p0[0], p.z - p0[1]).toFixed(1), saves: g.state.solverSaves - saves0, pills: [...pills], carriedBy: g.capy.carriedBy ? 'yes' : null, lastError: g.state.lastError || null }
    }, k)
    trials.push(r)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=l7r-qa-monaco2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, { trials })
}
