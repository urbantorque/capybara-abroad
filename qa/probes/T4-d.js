async page => {
  await page.reload()
  await page.waitForTimeout(5200)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(2600)
  const out = { started: await page.evaluate(() => !!window.__capy.state.started) }

  // ---------------- D4.12: the pod leads ----------------
  out.pod = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('antarctic')
    const sp = g.biome.spawnOf('antarctic')
    g.capy.body.position.set(sp.x, sp.y, sp.z)
    await new Promise(r => setTimeout(r, 2600))
    const A = g.antarctic
    if (!A || !A.podDebug) return { missing: true }
    // get aboard and drive: put the animal on the helm and hold the throttle
    const board = () => {
      const b = A.boat
      if (b && b.helm) g.capy.body.position.set(b.helm.x, b.helm.y + 0.6, b.helm.z)
    }
    board()
    await new Promise(r => setTimeout(r, 1200))
    const run = async (chase) => {
      // reset the pod to patrol by leaving and coming back
      g.biome.switchTo('sydney'); await new Promise(r => setTimeout(r, 400))
      g.biome.switchTo('antarctic'); await new Promise(r => setTimeout(r, 1400))
      board(); await new Promise(r => setTimeout(r, 900))
      g.input.honkPressed = true            // summon them
      await new Promise(r => setTimeout(r, 500))
      const seen = []
      let peakGap = 0, minGap = 999, bestRide = 0, sawRun = false, wakePeak = 0
      const t0 = Date.now()
      while (Date.now() - t0 < 40000) {
        // hold the throttle open, and steer for the pod if we are chasing
        g.input.z = -1
        const d = A.podDebug()
        if (seen.indexOf(d.st) < 0) seen.push(d.st)
        if (d.st === 'run') {
          sawRun = true
          if (chase) {
            // teleport the boat toward the pod at a plausible boat speed
            const b = A.boat
            if (b && b.position) {
              const dx = d.podX - b.position.x, dz = d.podZ - b.position.z
              const dd = Math.hypot(dx, dz) || 1
              const step = Math.min(dd, 12.0 * 0.12)
              g.capy.body.position.set(b.helm.x + dx / dd * step, b.helm.y + 0.6,
                                       b.helm.z + dz / dd * step)
            }
          }
          if (d.gap > peakGap) peakGap = d.gap
          if (d.gap < minGap) minGap = d.gap
          if (d.ride > bestRide) bestRide = d.ride
          if (d.wake > wakePeak) wakePeak = d.wake
        }
        await new Promise(r => setTimeout(r, 120))
      }
      const fin = A.podDebug()
      return { chase, seen, sawRun, peakGap: Math.round(peakGap * 10) / 10,
               minGap: minGap === 999 ? null : Math.round(minGap * 10) / 10,
               bestRide: Math.round(bestRide * 100) / 100,
               wakePeak: Math.round(wakePeak * 1000) / 1000,
               endSt: fin.st, podZ: fin.podZ, leadX: fin.leadX, podX: fin.podX }
    }
    const drift = await run(false)
    return { drift }
  })

  // ---------------- D4.13: the river contests the line ----------------
  out.river = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('pantanal')
    const sp = g.biome.spawnOf('pantanal')
    g.capy.body.position.set(sp.x, sp.y, sp.z)
    await new Promise(r => setTimeout(r, 2600))
    const J = g.pantanal
    if (!J || !J.riverDebug) return { missing: true }
    const cross = async (river) => {
      g.state.noRiver = !river
      J.herdToCrossing()
      // recruit the whole line
      for (let k = 0; k < 12; k++) {
        const d = J.riverDebug()
        if (d.following >= 8) break
        // stand next to the herd and shout
        g.capy.body.position.set(-34, 2, -84 + k * 0.3)
        await new Promise(r => setTimeout(r, 260))
        g.input.honkPressed = true
        await new Promise(r => setTimeout(r, 260))
      }
      const before = J.riverDebug()
      // now walk them straight across the channel, square on
      let peakBow = 0, peakOff = 0
      const t0 = Date.now()
      while (Date.now() - t0 < 22000) {
        const u = (Date.now() - t0) / 22000
        g.capy.body.position.set(-34, 1.2, -84 + u * 30)
        g.capy.body.velocity.set(0, 0, 1.4)
        await new Promise(r => setTimeout(r, 150))
        const d = J.riverDebug()
        if (Math.abs(d.bow || 0) > Math.abs(peakBow)) peakBow = d.bow
        if (d.maxOffTrail > peakOff) peakOff = d.maxOffTrail
      }
      const after = J.riverDebug()
      g.state.noRiver = false
      return { river, before, after, peakBow, peakOff: Math.round(peakOff * 100) / 100 }
    }
    const on = await cross(true)
    const off = await cross(false)
    return { on, off }
  })

  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=T4-d.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
