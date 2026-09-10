async page => {
  await page.reload()
  await page.waitForTimeout(5200)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2200)
  const out = {}

  out.sahara = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('sahara')
    const sp = g.biome.spawnOf('sahara')
    g.capy.body.position.set(sp.x, sp.y, sp.z)
    await new Promise(r => setTimeout(r, 2200))
    const s = g.sahara
    if (!s || !s.chaseDebug) return { missing: true }
    const base = s.chaseDebug()

    // ---- M3: is a person cover? Stand a sight line straight through one ----
    const los = []
    for (let k = 0; k < 8 && k < base.cover; k++) {
      const c = s.coverAt(k)
      if (!c) continue
      // a viewer 12 m one side, a target 0.9 m the other side of the SAME person
      const a = k * 0.7
      const vx = c.x + Math.cos(a) * 12, vz = c.z + Math.sin(a) * 12
      const tx = c.x - Math.cos(a) * 0.9, tz = c.z - Math.sin(a) * 0.9
      const blocked = !s.losTest(vx, vz, tx, tz)
      // ...and the control: the same length of line, 6 m to one side of them
      const ox = Math.cos(a + Math.PI / 2) * 6, oz = Math.sin(a + Math.PI / 2) * 6
      const clear = s.losTest(vx + ox, vz + oz, tx + ox, tz + oz)
      los.push({ k, blocked, controlClear: clear })
    }
    // and with the term cut
    g.state.noCover = true
    let cutBlocked = 0
    for (let k = 0; k < 8 && k < base.cover; k++) {
      const c = s.coverAt(k); if (!c) continue
      const a = k * 0.7
      if (!s.losTest(c.x + Math.cos(a) * 12, c.z + Math.sin(a) * 12,
                     c.x - Math.cos(a) * 0.9, c.z - Math.sin(a) * 0.9)) cutBlocked++
    }
    g.state.noCover = false

    // ---- M2 + M4: run a chase and watch the shout and the wake ----
    const runChase = async (part) => {
      g.state.noPart = !part
      s.forceChase()
      // stand in the middle of the souk so all six converge through the crowd
      let peakShoved = 0, peakTold = 0, peakSeeing = 0
      const t0 = Date.now()
      while (Date.now() - t0 < 16000) {
        g.capy.body.position.set(-20, 0.4, -44)
        g.capy.body.velocity.set(0, 0, 0)
        await new Promise(r => setTimeout(r, 220))
        const d = s.chaseDebug()
        if (d.shoved > peakShoved) peakShoved = d.shoved
        if (d.told > peakTold) peakTold = d.told
        if (d.seeing > peakSeeing) peakSeeing = d.seeing
      }
      return { peakShoved, peakTold, peakSeeing, end: s.chaseDebug() }
    }
    const partOn = await runChase(true)
    const partOff = await runChase(false)
    g.state.noPart = false
    return { base, los, cutBlocked, partOn, partOff }
  })

  out.goreme = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('goreme')
    const sp = g.biome.spawnOf('goreme')
    g.capy.body.position.set(sp.x, sp.y, sp.z)
    await new Promise(r => setTimeout(r, 2200))
    const G = g.goreme
    if (!G || !G.fieldDebug) return { missing: true }
    const before = G.fieldDebug()
    // C1: wind the dawn to just before the launch and watch it go
    G.setPhase(0.27)
    const at0 = G.fieldDebug()
    await new Promise(r => setTimeout(r, 6000))
    const at6 = G.fieldDebug()
    await new Promise(r => setTimeout(r, 9000))
    const at15 = G.fieldDebug()

    // C4: call the mare. Stand inside 45 m and wheek while it is waiting.
    let herd = null
    {
      G.setPhase(0.10)
      g.capy.body.position.set(G.herdCallSpot ? 0 : 0, 8, 0)
      // walk to the herd line and wait for a dwell
      let waited = 0, sawWait = null
      const t0 = Date.now()
      while (Date.now() - t0 < 22000) {
        await new Promise(r => setTimeout(r, 300))
        const d = G.fieldDebug()
        // park the animal beside the herd wherever it is
        g.capy.body.position.set(28, 9, d.herdZ)
        g.capy.body.velocity.set(0, 0, 0)
        if (d.herdWait > 1.0 && !sawWait) sawWait = d
        if (sawWait && !waited) {
          // wheek
          const ev = new KeyboardEvent('keydown', { code: 'KeyQ', key: 'q', bubbles: true })
          window.dispatchEvent(ev)
          await new Promise(r => setTimeout(r, 120))
          window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyQ', key: 'q', bubbles: true }))
          await new Promise(r => setTimeout(r, 400))
          waited = 1
          herd = { waitBefore: sawWait.herdWait, waitAfter: G.fieldDebug().herdWait }
          break
        }
      }
    }

    // C5: bring the doves down
    G.setPhase(0.30)
    const doveBefore = G.fieldDebug()
    G.lureDoves(6, -20)
    await new Promise(r => setTimeout(r, 9000))
    const doveAfter = G.fieldDebug()
    await new Promise(r => setTimeout(r, 3000))
    const doveMid = G.fieldDebug()
    return { before, at0, at6, at15, herd, doveBefore, doveAfter, doveMid }
  })

  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=T4-b.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
