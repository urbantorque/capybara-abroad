async page => {
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(6000)
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(3000)
  await page.evaluate(async () => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
    const g = window.__capy
    const W = window
    W.__log = []
    const oT = g.toast
    g.toast = function (s) { W.__log.push('toast: ' + s); return oT.apply(g, arguments) }
    g.events.on('task:complete', e => W.__log.push('TASK: ' + (e && e.id)))
    g.biome.switchTo('kyoto')
    const sp = g.biome.spawnOf('kyoto'), cb = g.capy.body
    cb.position.set(sp.x, sp.y, sp.z); cb.velocity.set(0, 0, 0)
    cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position)
    await sleep(2500)
    // the gate path, straight off the biome's own api
    const api = g.kyoto
    W.__gates = []
    for (let i = 0; i < 44; i++) {
      const t = i / 43
      const x = (-6 + (-34 + 4 + 6) * t) + Math.sin(t * 4.4) * 6.5
      const z = -46 + (-128 + 26 + 46) * t
      W.__gates.push({ x: x, z: z })
    }
    // Put the animal at the bottom gate. The steer below has no pathfinding and
    // the walk out from the Kyoto spawn runs into a wall; the tunnel corridor
    // itself is clear by construction.
    const g0 = W.__gates[0]
    const y0 = api && api.terrainHeight ? api.terrainHeight(g0.x, g0.z + 6) : 0
    cb.position.set(g0.x, (isFinite(y0) ? y0 : 0) + 1.0, g0.z + 6)
    cb.velocity.set(0, 0, 0)
    cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position)
    await sleep(1500)
    W.__drive = null
    W.__gi = 0
    W.__t0 = 0
    W.__startRun = () => {
      const keys = { KeyW: 0, KeyA: 0, KeyS: 0, KeyD: 0, ShiftLeft: 0 }
      const set = (c, v) => {
        if (keys[c] === v) return
        keys[c] = v
        window.dispatchEvent(new KeyboardEvent(v ? 'keydown' : 'keyup', { code: c, bubbles: true }))
      }
      W.__t0 = performance.now()
      W.__stopRun = () => { for (const c of Object.keys(keys)) set(c, 0) }
      W.__drive = setInterval(() => {
        const p = g.capy.position
        // advance the aim when we are near the current gate
        while (W.__gi < 43 && Math.hypot(p.x - W.__gates[W.__gi].x, p.z - W.__gates[W.__gi].z) < 5) W.__gi++
        const tg = W.__gates[Math.min(W.__gi, 43)]
        const dx = tg.x - p.x, dz = tg.z - p.z
        const yaw = g.input.camYaw || 0
        const cy = Math.cos(yaw), sy = Math.sin(yaw)
        const len = Math.hypot(dx, dz) || 1
        const Dx = dx / len, Dz = dz / len
        // capybara.js: worldX = ix*cy + iz*sy, worldZ = -ix*sy + iz*cy.
        // That matrix has determinant 1, so the inverse is its transpose.
        const ix = cy * Dx - sy * Dz
        const iz = sy * Dx + cy * Dz
        set('KeyD', ix > 0.3 ? 1 : 0)
        set('KeyA', ix < -0.3 ? 1 : 0)
        set('KeyS', iz > 0.3 ? 1 : 0)
        set('KeyW', iz < -0.3 ? 1 : 0)
        set('ShiftLeft', 1)
      }, 33)
    }
    W.__startRun()
  })
  const samples = []
  for (let i = 0; i < 24; i++) {
    await page.waitForTimeout(5000)
    const s = await page.evaluate(() => {
      const g = window.__capy
      return { gi: window.__gi, x: Math.round(g.capy.position.x), z: Math.round(g.capy.position.z),
               y: Math.round(g.capy.position.y), log: window.__log.slice(-3) }
    })
    samples.push(s)
    if (s.log.some(l => /torii-run|whole torii|senbon/i.test(l)) || s.gi >= 43) break
  }
  const out = await page.evaluate(() => {
    window.__stopRun()
    clearInterval(window.__drive)
    return { gi: window.__gi, log: window.__log.slice(-14),
             secs: Math.round((performance.now() - window.__t0) / 100) / 10 }
  })
  await page.evaluate(o => fetch('/shot?name=v51torii.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), { samples, out })
}
