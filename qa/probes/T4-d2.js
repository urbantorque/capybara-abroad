async page => {
  await page.reload()
  await page.waitForTimeout(5200)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(2600)
  const out = { started: await page.evaluate(() => !!window.__capy.state.started) }

  // ---------------- D4.12: does the pod actually LEAVE? ----------------
  out.pod = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('antarctic')
    g.capy.body.position.set(0, 5.7, 48)
    await new Promise(r => setTimeout(r, 2600))
    const A = g.antarctic
    if (!A || !A.podForce) return { missing: true }
    const trial = async (chase, allow) => {
      g.state.noPodRun = !allow
      A.podForce()
      // stand on the helm rig so antHelmOn can be true, and hold the throttle
      const seen = []
      let sawRun = false, peakGap = 0, minGap = 999, bestRide = 0, wakePeak = 0
      let podStart = null, podEnd = null, leadErr = 0, leadN = 0
      const t0 = Date.now()
      while (Date.now() - t0 < 34000) {
        g.input.z = -1
        const d = A.podDebug()
        if (seen.indexOf(d.st) < 0) seen.push(d.st)
        if (d.st === 'run') {
          if (!sawRun) { sawRun = true; podStart = d.podZ }
          podEnd = d.podZ
          leadErr += Math.abs(d.podX - d.leadX); leadN++
          if (chase) {
            // a boat that can do 12.6 keeps up; drive it at the pod
            const dx = d.podX - d.boatZ * 0, dz = d.podZ
            g.antarctic.boat.position.x = d.podX
            g.antarctic.boat.position.z = d.podZ + 9
          }
          if (d.gap > peakGap) peakGap = d.gap
          if (d.gap < minGap) minGap = d.gap
          if (d.ride > bestRide) bestRide = d.ride
          if (d.wake > wakePeak) wakePeak = d.wake
        }
        await new Promise(r => setTimeout(r, 110))
      }
      const fin = A.podDebug()
      g.state.noPodRun = false
      return { chase, allow, seen, sawRun,
               ranM: (podStart !== null && podEnd !== null) ? Math.round((podStart - podEnd) * 10) / 10 : 0,
               meanLeadErr: leadN ? Math.round((leadErr / leadN) * 100) / 100 : null,
               peakGap: Math.round(peakGap * 10) / 10,
               minGap: minGap === 999 ? null : Math.round(minGap * 10) / 10,
               bestRide: Math.round(bestRide * 100) / 100,
               wakePeak: Math.round(wakePeak * 1000) / 1000, endSt: fin.st }
    }
    const alone = await trial(false, true)
    const kept = await trial(true, true)
    const cut = await trial(false, false)
    return { alone, kept, cut }
  })

  // ---------------- D4.13: a REAL crossing ----------------
  out.river = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('pantanal')
    g.capy.body.position.set(0, 2.1, 62)
    await new Promise(r => setTimeout(r, 2600))
    const J = g.pantanal
    if (!J || !J.riverDebug) return { missing: true }
    const walk = async (x0, z0, x1, z1, ms) => {
      const t0 = Date.now()
      while (Date.now() - t0 < ms) {
        const u = (Date.now() - t0) / ms
        const x = x0 + (x1 - x0) * u, z = z0 + (z1 - z0) * u
        g.capy.body.position.set(x, Math.max(J.terrainHeight(x, z), -0.2) + 0.4, z)
        g.capy.body.velocity.set((x1 - x0) / (ms / 1000), 0, (z1 - z0) / (ms / 1000))
        await new Promise(r => setTimeout(r, 90))
      }
    }
    const cross = async (river) => {
      g.state.noRiver = !river
      // reset the herd by leaving and coming back, so the trail is empty too
      g.biome.switchTo('sydney'); await new Promise(r => setTimeout(r, 400))
      g.biome.switchTo('pantanal'); await new Promise(r => setTimeout(r, 1500))
      // walk to the herd's own paddock and gather them properly
      await walk(0, 62, -14, 34, 6000)
      for (let k = 0; k < 14; k++) {
        const d = J.riverDebug()
        if (d.following >= 7) break
        g.input.honkPressed = true
        await new Promise(r => setTimeout(r, 700))
        // wander among them so each shout finds a different nearest one
        await walk(-14 + (k % 3) * 6, 34 - (k % 4) * 5, -10 + (k % 5) * 4, 30 - (k % 3) * 6, 900)
      }
      const gathered = J.riverDebug()
      // ...and now lead them square across the channel
      let peakBow = 0, peakOff = 0
      const t0 = Date.now()
      const T = 26000
      while (Date.now() - t0 < T) {
        const u = (Date.now() - t0) / T
        const x = -34, z = -50 + u * -40
        g.capy.body.position.set(x, Math.max(J.terrainHeight(x, z), -0.2) + 0.4, z)
        g.capy.body.velocity.set(0, 0, -40 / (T / 1000))
        await new Promise(r => setTimeout(r, 110))
        const d = J.riverDebug()
        if (Math.abs(d.bow || 0) > Math.abs(peakBow)) peakBow = d.bow
        if (d.maxOffTrail > peakOff) peakOff = d.maxOffTrail
      }
      const after = J.riverDebug()
      g.state.noRiver = false
      return { river, gathered: gathered.following, after,
               peakBow: Math.round((peakBow || 0) * 100) / 100,
               peakOff: Math.round(peakOff * 100) / 100 }
    }
    const on = await cross(true)
    const off = await cross(false)
    return { on, off }
  })

  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=T4-d2.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
