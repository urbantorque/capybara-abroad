async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  const CHAPTER = 'manly'
  const out = { errs, chapter: CHAPTER }
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__capy && document.querySelector('.capyui-go'), null, { timeout: 120000, polling: 500 })
  await page.waitForTimeout(1500)
  await page.evaluate(() => document.querySelector('.capyui-go').click())
  await page.waitForFunction(() => window.__capy.state && window.__capy.state.started, null, { timeout: 60000, polling: 500 })
  await page.waitForTimeout(1500)
  await page.evaluate((n) => window.__capy.hud.cross(n), CHAPTER)
  await page.waitForFunction((n) => window.__capy.biome.current === n, CHAPTER, { timeout: 60000, polling: 500 })
  await page.waitForTimeout(6000)

  out.result = await page.evaluate(() => {
    const g = window.__capy, T = g.THREE
    const cam = g.camera.clone(); cam.updateMatrixWorld()
    const far = g.far
    if (!far || !far.mover) return { skipped: 'no far mover' }
    const mover = far.mover
    const period = mover.period
    let inFrame = 0, aboveTop = 0, visibleSamples = 0, total = 0
    const dt = 0.1
    const rows = []
    for (let t = 0; t < period; t += dt) {
      mover.update(dt)
      total++
      if (!mover.mesh.visible) continue
      visibleSamples++
      const v = mover.mesh.getWorldPosition(new T.Vector3()).project(cam)
      const inX = v.x > -1 && v.x < 1
      const inY = v.y > -1 && v.y < 1
      if (inX && inY) inFrame++
      else if (inX && v.y >= 1) aboveTop++
      if (Math.round(t * 10) % 20 === 0) rows.push({ t: +t.toFixed(1), ndc: [+v.x.toFixed(2), +v.y.toFixed(2)] })
    }
    return { period, dtyDuty: mover.mesh.visible, totalSteps: total, visibleSamples,
             inFramePct: +(100 * inFrame / Math.max(1, visibleSamples)).toFixed(1),
             aboveTopPct: +(100 * aboveTop / Math.max(1, visibleSamples)).toFixed(1),
             inFrameSeconds: +(inFrame * dt).toFixed(1), aboveTopSeconds: +(aboveTop * dt).toFixed(1),
             visibleSeconds: +(visibleSamples * dt).toFixed(1), rows }
  })

  await page.evaluate(async (o) => { await fetch('/shot?name=w1-ferry-check.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
