async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  const CHAPTER = 'palawan'
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

  out.spot = await page.evaluate((chap) => {
    const g = window.__capy
    const api = g[chap]
    let deepest = { d: 0, x: 0, z: 0 }
    for (let r = 5; r < 260; r += 3) {
      for (let t = 0; t < 32; t++) {
        const a = t / 32 * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r
        if (!api.isOverWater(x, z)) continue
        const th = api.terrainHeight(x, z)
        if (th < deepest.d) deepest = { d: th, x, z }
        if (th < -3.5) {
          const b = g.capy.body
          b.position.set(x, 0.4, z); b.velocity.set(0, 0, 0)
          b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
          b.aabbNeedsUpdate = true
          return { x: +x.toFixed(1), z: +z.toFixed(1), t: +api.terrainHeight(x, z).toFixed(2), fallback: false }
        }
      }
    }
    if (deepest.d < -0.6) {
      const b = g.capy.body
      b.position.set(deepest.x, 0.4, deepest.z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      b.aabbNeedsUpdate = true
      return { x: +deepest.x.toFixed(1), z: +deepest.z.toFixed(1), t: +deepest.d.toFixed(2), fallback: true }
    }
    return null
  }, CHAPTER)
  await page.waitForTimeout(1500)

  await page.keyboard.down('KeyE')
  await page.waitForTimeout(700)
  await page.keyboard.down('KeyW')
  const profile = []
  for (let i = 0; i < 35; i++) {
    await page.waitForTimeout(150)
    const d = await page.evaluate(() => {
      const g = window.__capy
      return { depth: +(g.capy.depth || 0).toFixed(3), y: +g.capy.body.position.y.toFixed(3),
               alive: g.weather.diveAudit().alive, rawDt: g.state.rawDt }
    })
    profile.push(d)
  }
  await page.keyboard.up('KeyW'); await page.keyboard.up('KeyE')
  out.profile = profile

  await page.evaluate(async (o) => { await fetch('/shot?name=w1-depth-profile-' + o.chapter + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
