async page => {
  const errs = []
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 180)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(6500)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)

  // ---- set up the flight by hand, then hand the last seconds to rAF -------
  const setup = await page.evaluate(() => {
    const g = window.__capy
    const R = { log: [] }
    g.biome.switchTo('goreme')
    const A = g.goreme, b = g.capy.body
    const bp = A.balloon()
    b.position.set(bp.x, bp.y + 0.9, bp.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    const inp = g.input
    inp.x = 0; inp.z = 0; inp.run = false
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false)
    // hold the burner and wait for the shot to be requested
    let fired = -1, peak = 0
    for (let i = 0; i < 60 * 400; i++) {
      inp.action = true
      g.tick(1 / 60, false)
      const w = typeof g.framing === 'function' ? g.framing() : 0
      if (w > peak) peak = w
      if (w > 0.3 && fired < 0) { fired = i / 60; break }
      // stay in the basket: the animal is carried, but re-seat if it drifts
      const p = A.balloon()
      if (Math.abs(b.position.x - p.x) > 1.2 || Math.abs(b.position.z - p.z) > 1.2) {
        b.position.x = p.x; b.position.z = p.z
        b.velocity.x = 0; b.velocity.z = 0
      }
    }
    R.firedAtS = fired
    R.peakW = +peak.toFixed(3)
    R.alt = +(g.capy.position.y).toFixed(1)
    R.err = g.state.lastError || null
    return R
  })
  // ---- let rAF draw the held shot, then photograph it --------------------
  await page.evaluate(() => new Promise(r => setTimeout(r, 1200)))
  const after = await page.evaluate(() => {
    const g = window.__capy
    const c = g.capy.position, e = g.camera.position
    return { w: +g.framing().toFixed(3),
             bearingDeg: +(Math.atan2(e.x - c.x, e.z - c.z) * 180 / Math.PI).toFixed(1),
             dist: +Math.hypot(e.x - c.x, e.z - c.z).toFixed(2),
             camY: +e.y.toFixed(2), capyY: +c.y.toFixed(2),
             err: g.state.lastError || null }
  })
  const out = { setup, after, pageErrors: errs }
  await page.evaluate(async (o) => { await fetch('/shot?name=b4-gorshot.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
