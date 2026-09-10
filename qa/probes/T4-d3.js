async page => {
  await page.reload()
  await page.waitForTimeout(5200)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(2600)
  const out = { started: await page.evaluate(() => !!window.__capy.state.started) }

  out.pod = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('antarctic')
    g.capy.body.position.set(0, 5.7, 48)
    await new Promise(r => setTimeout(r, 2600))
    const A = g.antarctic
    if (!A || !A.podForce) return { missing: true }
    const trial = async (chase, allow) => {
      g.state.noPodRun = !allow
      // THE ESCORT EXITS AT antBoatZ > -40 — she has come home. The boat sits
      // at the jetty at z ~ +40, so an escort forced there drops to patrol on
      // the very next frame and the run can never be reached. Put her out in
      // the crossing, where the marquee actually happens.
      A.boat.position.z = -150
      A.boat.position.x = 10
      const seen = []
      let sawRun = false, peakGap = 0, minGap = 999, bestRide = 0, wakePeak = 0
      let podStart = null, podEnd = null, leadErr = 0, leadN = 0
      A.podForce()
      const t0 = Date.now()
      while (Date.now() - t0 < 32000) {
        const d = A.podDebug()
        if (seen.indexOf(d.st) < 0) seen.push(d.st)
        if (d.st === 'run') {
          if (!sawRun) { sawRun = true; podStart = d.podZ }
          podEnd = d.podZ
          leadErr += Math.abs(d.podX - d.leadX); leadN++
          if (chase) { A.boat.position.x = d.podX; A.boat.position.z = d.podZ + 9 }
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
               wakePeak: Math.round(wakePeak * 1000) / 1000, endSt: fin.st,
               helm: fin.helm, boatSp: fin.boatSp, boatZ: fin.boatZ, stateT: fin.stateT }
    }
    const alone = await trial(false, true)
    const kept = await trial(true, true)
    const cut = await trial(false, false)
    return { alone, kept, cut }
  })

  out.river = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('pantanal')
    g.capy.body.position.set(0, 2.1, 62)
    await new Promise(r => setTimeout(r, 2600))
    const J = g.pantanal
    if (!J || !J.riverDebug) return { missing: true }
    const put = (x, z) => {
      g.capy.body.position.set(x, Math.max(J.terrainHeight(x, z), -0.25) + 0.4, z)
    }
    const walk = async (x0, z0, x1, z1, ms) => {
      const t0 = Date.now()
      while (Date.now() - t0 < ms) {
        const u = (Date.now() - t0) / ms
        const x = x0 + (x1 - x0) * u, z = z0 + (z1 - z0) * u
        put(x, z)
        g.capy.body.velocity.set((x1 - x0) / (ms / 1000), 0, (z1 - z0) / (ms / 1000))
        await new Promise(r => setTimeout(r, 90))
      }
    }
    const cross = async (river) => {
      g.state.noRiver = !river
      // put the herd back on the near bank EVERY time, so both legs of the
      // A/B start from the same place. Leaving and re-entering resets state
      // but NOT position, so run two of the first version gathered one animal.
      J.herdToCrossing()
      await new Promise(r => setTimeout(r, 300))
      // ...and the herd is at z -86, on the far side. Bring them to the near
      // bank instead by walking a continuous path — the trail must be REAL or
      // every follower reads as 140 m off its own place.
      put(-34, -46)
      await new Promise(r => setTimeout(r, 400))
      await walk(-34, -46, -34, -82, 9000)
      for (let k = 0; k < 16; k++) {
        const d = J.riverDebug()
        if (d.following >= 7) break
        g.input.honkPressed = true
        await new Promise(r => setTimeout(r, 500))
        await walk(-34 + (k % 3) * 3, -82 - (k % 2) * 2, -32 + (k % 4) * 2, -84 + (k % 3) * 2, 700)
      }
      const gathered = J.riverDebug().following
      // and now lead them back across, square on, at a swim
      let peakBow = 0, peakOff = 0
      const T = 24000
      const t0 = Date.now()
      while (Date.now() - t0 < T) {
        const u = (Date.now() - t0) / T
        const z = -84 + u * 34
        put(-34, z)
        g.capy.body.velocity.set(0, 0, 34 / (T / 1000))
        await new Promise(r => setTimeout(r, 110))
        const d = J.riverDebug()
        if (Math.abs(d.bow || 0) > Math.abs(peakBow)) peakBow = d.bow
        if (d.maxOffTrail > peakOff) peakOff = d.maxOffTrail
      }
      const after = J.riverDebug()
      const jag = J.jaguarDebug()
      g.state.noRiver = false
      return { river, gathered, after, jagSt: jag.st, jagRuns: jag.runs, dusk: jag.dusk,
               peakBow: Math.round((peakBow || 0) * 100) / 100,
               peakOff: Math.round(peakOff * 100) / 100 }
    }
    const on = await cross(true)
    const off = await cross(false)
    // ...and once more with the predator suppressed, to settle whether the
    // control run above lost its followers to the river or to the jaguar
    g.state.noHunt = true
    const offNoHunt = await cross(false)
    const onNoHunt = await cross(true)
    g.state.noHunt = false
    return { on, off, offNoHunt, onNoHunt }
  })

  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=T4-d3.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
