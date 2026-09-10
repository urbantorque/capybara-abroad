async page => {
  await page.reload()
  await page.waitForTimeout(5200)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2200)
  const out = {}

  // =============================== MARRAKECH ===============================
  out.m3 = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('sahara')
    const sp = g.biome.spawnOf('sahara')
    g.capy.body.position.set(sp.x, sp.y, sp.z)
    await new Promise(r => setTimeout(r, 2200))
    const s = g.sahara
    const base = s.chaseDebug()
    // For each cover person, run the SAME line twice: once with the term and
    // once with it cut. Only a line that is blocked with and clear without is
    // evidence that the person blocked it.
    let byPerson = 0, byWall = 0, neither = 0, tested = 0
    const cases = []
    for (let k = 0; k < base.cover; k++) {
      const c = s.coverAt(k); if (!c) continue
      const a = (k * 2.399963) % 6.28318
      const vx = c.x + Math.cos(a) * 9, vz = c.z + Math.sin(a) * 9
      const tx = c.x - Math.cos(a) * 1.6, tz = c.z - Math.sin(a) * 1.6
      g.state.noCover = false
      const withT = !s.losTest(vx, vz, tx, tz)
      g.state.noCover = true
      const without = !s.losTest(vx, vz, tx, tz)
      g.state.noCover = false
      tested++
      if (withT && !without) { byPerson++; if (cases.length < 4) cases.push({ k, vx: +vx.toFixed(1), vz: +vz.toFixed(1) }) }
      else if (without) byWall++
      else neither++
    }
    return { cover: base.cover, tested, byPerson, byWall, neither, cases, ppl: base.ppl, goats: base.goats }
  })

  out.m2 = await page.evaluate(async () => {
    const g = window.__capy
    const s = g.sahara
    const run = async (x, z, label) => {
      // reset: end any chase, then start a fresh one with the animal in sight
      g.capy.body.position.set(x, 0.4, z)
      g.capy.body.velocity.set(0, 0, 0)
      await new Promise(r => setTimeout(r, 900))
      s.forceChase()
      let peakTold = 0, peakSeeing = 0, peakShoved = 0, minNear = 999
      const t0 = Date.now()
      while (Date.now() - t0 < 15000) {
        g.capy.body.position.set(x, 0.4, z)
        g.capy.body.velocity.set(0, 0, 0)
        await new Promise(r => setTimeout(r, 200))
        const d = s.chaseDebug()
        if (d.told > peakTold) peakTold = d.told
        if (d.seeing > peakSeeing) peakSeeing = d.seeing
        if (d.shoved > peakShoved) peakShoved = d.shoved
        if (d.near < minNear) minNear = d.near
      }
      const fin = s.chaseDebug(); return { label, peakTold, peakSeeing, peakShoved, minNear: +minNear.toFixed(1), pairs: fin.tellPairs, near2: fin.tellNear, los: fin.tellLos, chase: fin.chase }
    }
    // in the square, where the six stalls are: everybody can see it
    const square = await run(0, 8, 'square')
    const behind = await run(-46, -50, 'deep souk')
    // at the mouth of the souk: some can see it, some cannot — the shout's case
    const mouth = await run(-30, -30, 'souk mouth')
    return { square, mouth, behind }
  })

  // =============================== CAPPADOCIA ==============================
  out.gor = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('goreme')
    const sp = g.biome.spawnOf('goreme')
    g.capy.body.position.set(sp.x, sp.y, sp.z)
    await new Promise(r => setTimeout(r, 2200))
    const G = g.goreme
    const info = G.fieldDebug()
    // C5, from the chapter's own coordinates rather than a guess
    G.setPhase(0.30)
    const lx = info.cliffX + 14, lz = info.cliffZ + 8
    const before = G.fieldDebug()
    const took = G.lureDoves(lx, lz)
    let peakDown = 0
    for (let t = 0; t < 26; t++) {
      await new Promise(r => setTimeout(r, 700))
      const d = G.fieldDebug()
      if (d.onTheGround > peakDown) peakDown = d.onTheGround
    }
    const after = G.fieldDebug()
    return { info, lx: +lx.toFixed(1), lz: +lz.toFixed(1), took, before, peakDown, after }
  })

  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=T4-b2.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
