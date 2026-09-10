async page => {
  await page.reload()
  await page.waitForTimeout(5600)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(2600)
  const out = { started: await page.evaluate(() => !!window.__capy.state.started) }

  out.geom = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('cave')
    const sp = g.biome.spawnOf('cave')
    g.capy.body.position.set(sp.x, sp.y, sp.z)
    await new Promise(r => setTimeout(r, 2600))
    const C = g.cave
    if (!C || !C.columnDebug) return { missing: true }
    const d = C.columnDebug()
    // probe the ramp: from the foot, walk a ring at each height and find the
    // highest solid surface, to prove the shelf is continuous and climbable
    return { ...d, bodies: g.world.bodies.length }
  })

  // ---- can the animal actually WALK up it? drive it round the spiral ----
  out.walk = await page.evaluate(async () => {
    const g = window.__capy, C = g.cave
    const d0 = C.columnDebug()
    // start at the foot of the ramp
    const put = (x, y, z) => { g.capy.body.position.set(x, y, z); g.capy.body.velocity.set(0, 0, 0) }
    put(4 + Math.cos(2.1) * 4.7, d0.base + 1.2, -48 + Math.sin(2.1) * 4.7)
    await new Promise(r => setTimeout(r, 900))
    // follow the shelf by dead reckoning and record the ground under the animal
    let ra = 2.1, dy = 0.7, stuck = 0, maxY = -99
    const samples = []
    for (let k = 0; k < 260; k++) {
      const rr = (3.6 + (1.5 - 3.6) * Math.min(dy / 28, 1)) + 1.05
      const x = 4 + Math.cos(ra) * rr, z = -48 + Math.sin(ra) * rr
      // drop the animal onto the shelf from just above it and see where it rests
      g.capy.body.position.set(x, d0.base + dy + 0.55, z)
      g.capy.body.velocity.set(0, 0, 0)
      await new Promise(r => setTimeout(r, 45))
      const y = g.capy.body.position.y - d0.base
      if (y > maxY) maxY = y
      if (k % 26 === 0) samples.push({ dy: Math.round(dy * 10) / 10, rest: Math.round(y * 100) / 100 })
      if (y < dy - 1.4) stuck++
      ra += 0.95 / rr
      dy += 0.20
      if (dy > 28) break
    }
    return { maxY: Math.round(maxY * 100) / 100, stuck, samples,
             skyKonRamp: C.columnDebug().skyK, climbing: !!g.capy.climbing }
  })

  // ---- the drop ----
  out.drop = await page.evaluate(async () => {
    const g = window.__capy, C = g.cave
    const d0 = C.columnDebug()
    const run = async () => {
      // stand on the cap and step off
      g.capy.body.position.set(4, d0.top + 0.6, -48)
      g.capy.body.velocity.set(0, 0, 0)
      await new Promise(r => setTimeout(r, 1200))
      const onTop = C.columnDebug()
      // walk off the edge
      g.capy.body.position.set(4 + 5.4, d0.top + 0.6, -48)
      g.capy.body.velocity.set(2.0, 0, 0)
      let peakFall = 0, minSwiftR = 999, sawFall = false
      const samplesG = []
      const t0 = Date.now()
      while (Date.now() - t0 < 9000) {
        await new Promise(r => setTimeout(r, 60))
        const d = C.columnDebug()
        if (d.fall > peakFall) peakFall = d.fall
        if (d.fall > 0.5) sawFall = true
        if (d.swiftR !== null && d.fall > 0.7 && d.swiftR < minSwiftR) minSwiftR = d.swiftR
        if (samplesG.length < 5) samplesG.push({vy:d.vy,above:d.above,g:d.grounded,ig:d.inGlade,f:d.fall})
        if (d.done) break
      }
      return { gate: samplesG, onTopY: onTop.topped, peakFall: Math.round(peakFall * 100) / 100,
               sawFall, minSwiftR: minSwiftR === 999 ? null : minSwiftR,
               fin: C.columnDebug() }
    }
    const a = await run()
    return a
  })

  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=T4-col.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
