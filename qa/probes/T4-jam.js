async page => {
  await page.reload()
  await page.waitForTimeout(5200)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2200)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('hanoi')
    const sp = g.biome.spawnOf('hanoi')
    g.capy.body.position.set(sp.x, sp.y, sp.z)
    await new Promise(r => setTimeout(r, 2000))
    const h = g.hanoi
    if (!h || !h.jamTest) return { missing: true }
    // find a bike on lane 2 — the ring round the lake, which is CLOSED, so
    // traffic cannot wrap away past a stopped machine
    let pin = -1
    for (let i = 0; i < 240 && pin < 0; i++) {
      const r = h.jamTest(i, true)
      h.jamTest(i, false)
      if (r && r.lane === 2) pin = i
    }
    const run = async (jam) => {
      g.state.noJam = !jam
      const t0 = Date.now()
      let best = null, peak = -1, samples = []
      while (Date.now() - t0 < 26000) {
        const r = h.jamTest(pin, true)
        if (r && r.chain > peak) { peak = r.chain; best = r }
        if (samples.length < 6 && (Date.now() - t0) > samples.length * 4200) samples.push(r)
        await new Promise(r2 => setTimeout(r2, 200))
      }
      const bd = h.bikeDebug()
      h.jamTest(pin, false)
      await new Promise(r2 => setTimeout(r2, 3500))
      return { peakChain: peak, best, bd, samples }
    }
    const on = await run(true)
    const off = await run(false)
    g.state.noJam = false
    return { pin, on, off, err: g.state.lastError || null }
  })
  await page.evaluate(o => fetch('/shot?name=T4-jam.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
