async page => {
  const OUT = 'C:/Users/roger/OneDrive/Desktop/capy3/qa/'
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 900, height: 560 })
  await page.reload({ timeout: 90000 })
  await page.waitForTimeout(6000)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(7000)

  const RUN = (dt) => {
    const g = window.__capy
    const capy = g.capy, b = capy.body
    const api = g.env
    const x = 0, z = 22
    const h = (api && api.terrainHeight) ? api.terrainHeight(x, z) : 0
    const base = (typeof h === 'number' && h === h) ? h : 0
    b.position.set(x, base + 2.0 + 0.34, z)
    b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position)
    b.interpolatedPosition.copy(b.position)
    const rows = []
    let landedAt = -1
    for (let i = 0; i < 200; i++) {
      g.tick(dt, false)
      const a = capy.animAudit()
      const t = +(i * dt).toFixed(4)
      rows.push({ t, land: +a.land.toFixed(4), pop: +a.pop.toFixed(4),
                  by: +b.position.y.toFixed(3), vy: +a.vy.toFixed(2), gr: !!a.grounded })
      if (landedAt < 0 && a.grounded && i > 2) landedAt = t
      if (landedAt >= 0 && t - landedAt > 1.6) break
    }
    const after = rows.filter(r => r.t >= landedAt && landedAt >= 0)
    const lands = after.map(r => r.land)
    let minL = 0, maxL = 0, crossings = 0, prev = null
    for (const v of lands) {
      if (v < minL) minL = v
      if (v > maxL) maxL = v
      if (prev !== null && ((prev < -0.001 && v > 0.001) || (prev > 0.001 && v < -0.001))) crossings++
      prev = v
    }
    const tail = lands.slice(-8)
    return { dt: +dt.toFixed(5), n: rows.length, landedAt,
             peakDip: +minL.toFixed(4), peakUp: +maxL.toFixed(4),
             span: +(maxL - minL).toFixed(4), crossings,
             tailMaxAbs: +Math.max(...tail.map(Math.abs)).toFixed(4),
             hitClamp: minL <= -0.2999,
             rows: after.slice(0, 40) }
  }

  const out = { at: new Date().toISOString(), runs: [] }
  for (const dt of [1 / 60, 0.05, 0.0833, 0.1]) {
    try { out.runs.push(await page.evaluate(RUN, dt)) }
    catch (e) { out.runs.push({ dt, error: String(e).slice(0, 300) }) }
    await page.waitForTimeout(800)
  }
  await page.evaluate(o => fetch('/shot?name=px-spring.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))
  }), out)
}
