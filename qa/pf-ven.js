async page => {
  const errs = []
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)) })
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 200)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(7000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)

  const out = await page.evaluate(async () => {
    const g = window.__capy
    const r = { }
    g.biome.switchTo('venice')
    const sp = g.biome.spawnOf('venice'), b = g.capy.body
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
    const V = g.venice
    r.api = Object.keys(V)
    r.spawn = { x: sp.x, y: sp.y, z: sp.z }
    // --- tide cycle: sample level over 220 s of ticks, note phase timings
    const samples = []
    let t = 0
    for (let i = 0; i < 220 * 60; i++) {
      g.tick(1 / 60, false); t += 1 / 60
      if (i % 60 === 0) samples.push([+t.toFixed(1), +V.tide().toFixed(3), +V.tideY().toFixed(2),
        V.flooded() ? 1 : 0, V.rising() ? 1 : 0, +V.boardsOut().toFixed(2)])
    }
    r.tide = samples
    r.waterLevelProp = V.waterLevel
    return r
  })

  await page.evaluate(async (d) => {
    const b = btoa(unescape(encodeURIComponent(JSON.stringify(d))))
    await fetch('/shot?name=venA.json', { method: 'POST', body: b })
  }, { out, errs })
}
