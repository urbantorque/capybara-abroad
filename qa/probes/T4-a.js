async page => {
  await page.reload()
  await page.waitForTimeout(5200)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2200)
  const out = {}

  out.hanoi = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('hanoi')
    const sp = g.biome.spawnOf('hanoi')
    g.capy.body.position.set(sp.x, sp.y, sp.z)
    await new Promise(r => setTimeout(r, 1800))
    const h = g.hanoi
    if (!h || !h.bikeDebug) return { missing: true }
    const run = async (jam) => {
      g.state.noJam = !jam
      g.capy.body.position.set(1, 2.6, 40)
      g.capy.body.velocity.set(0, 0, 0)
      const t0 = Date.now()
      while (Date.now() - t0 < 14000) {
        await new Promise(r => setTimeout(r, 400))
        g.capy.body.position.set(1, 2.6, 40)
        g.capy.body.velocity.set(0, 0, 0)
      }
      return h.bikeDebug()
    }
    const on = await run(true)
    const off = await run(false)
    g.state.noJam = false
    return { on, off }
  })

  out.kyoto = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('kyoto')
    const sp = g.biome.spawnOf('kyoto')
    g.capy.body.position.set(sp.x, sp.y, sp.z)
    await new Promise(r => setTimeout(r, 2200))
    const k = g.kyoto
    if (!k || !k.birdDebug) return { missing: true }
    const before = k.birdDebug()
    k.ringBell()
    await new Promise(r => setTimeout(r, 700))
    const during = k.birdDebug()
    await new Promise(r => setTimeout(r, 2400))
    const justAfter = k.birdDebug()
    await new Promise(r => setTimeout(r, 3000))
    k.ringBell(); await new Promise(r => setTimeout(r, 700)); const ring2 = k.birdDebug(); await new Promise(r => setTimeout(r, 2400)); const after2 = k.birdDebug(); await new Promise(r => setTimeout(r, 3200)); const later = k.birdDebug()
    return { before, during, justAfter, ring2, after2, later }
  })

  out.queue = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('sydney')
    const sp = g.biome.spawnOf('sydney')
    g.capy.body.position.set(sp.x, sp.y, sp.z)
    await new Promise(r => setTimeout(r, 1500))
    let seen = {}, everQueued = {}, samples = 0
    const t0 = Date.now()
    while (Date.now() - t0 < 90000) {
      await new Promise(r => setTimeout(r, 1200))
      samples++
      const roll = g.faceAudit ? g.faceAudit() : []
      for (const r of roll) {
        if (r.state === 'queue') {
          seen[r.kind] = (seen[r.kind] || 0) + 1
          everQueued[r.id] = r.kind
        }
      }
    }
    return { samples, seen, distinct: Object.keys(everQueued).length,
             who: everQueued }
  })

  out.erg = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('sahara')
    const sp = g.biome.spawnOf('sahara')
    g.capy.body.position.set(sp.x, sp.y, sp.z)
    await new Promise(r => setTimeout(r, 1500))
    const s = g.sahara
    if (!s || !s.stormDebug) return { missing: true }
    const hold = async (x, z, ms) => {
      const t0 = Date.now()
      while (Date.now() - t0 < ms) {
        await new Promise(r => setTimeout(r, 250))
        g.capy.body.position.set(x, (s.terrainHeight ? s.terrainHeight(x, z) : 0) + 0.4, z)
        g.capy.body.velocity.set(0, 0, 0)
      }
      return s.stormDebug()
    }
    const start = s.stormDebug()
    const afterOut = await hold(200, 10, 10000)
    const afterBack = await hold(60, 10, 10000)
    return { start, afterOut, afterBack }
  })

  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=T4-a.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
