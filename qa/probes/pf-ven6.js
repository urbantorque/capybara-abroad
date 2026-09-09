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
    const r = {}
    g.biome.switchTo('venice')
    const sp = g.biome.spawnOf('venice'), b = g.capy.body
    const V = g.venice
    // stand in the middle of the piazza on DRY stone and settle
    b.position.set(-4, V.terrainHeight(-4, -35) + 0.6, -35); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 300; i++) g.tick(1 / 60, false)
    r.dryRest = { y: +g.capy.position.y.toFixed(3), bodyY: +b.position.y.toFixed(3),
      swim: !!g.capy.swimming, tideY: +V.tideY().toFixed(2),
      terr: +V.terrainHeight(-4, -35).toFixed(2) }
    // now let the tide come in under it and record the first frame it swims,
    // re-planting it each frame so it never drifts
    const ty = V.terrainHeight(-4, -35)
    let first = null, trace = []
    for (let i = 0; i < 260 * 60; i++) {
      g.tick(1 / 60, false)
      const wy = V.tideY()
      if (wy < ty - 0.5) continue
      const depth = wy - ty
      const sw = !!g.capy.swimming
      if (i % 30 === 0 && depth > -0.4 && depth < 1.0) {
        trace.push([+depth.toFixed(3), sw ? 1 : 0, +g.capy.position.y.toFixed(2),
          V.isOverWater(-4, -35) ? 1 : 0, +V.surfacePitch(-4, -35, ty).toFixed(2)])
      }
      if (sw && first === null) {
        first = { depth: +depth.toFixed(3), y: +g.capy.position.y.toFixed(3),
          isOverWater: V.isOverWater(-4, -35) ? 1 : 0,
          pitch: +V.surfacePitch(-4, -35, ty).toFixed(3), tide: +V.tide().toFixed(3) }
      }
      if (first && depth > 0.9) break
    }
    r.firstSwim = first
    r.trace = trace
    r.capyConsts = { swimEnter: g.capy.SWIM_ENTER, floatOff: g.capy.FLOAT_OFF }
    return r
  })

  await page.evaluate(async (d) => {
    const bb = btoa(unescape(encodeURIComponent(JSON.stringify(d))))
    await fetch('/shot?name=venF.json', { method: 'POST', body: bb })
  }, { out, errs })
}
