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

  out.result = await page.evaluate((chap) => {
    const g = window.__capy
    const api = chap === 'sydney' ? g.env : g[chap]
    let deepest = { d: 0, x: 0, z: 0 }
    for (let r = 5; r < 260; r += 3) {
      for (let t = 0; t < 32; t++) {
        const a = t / 32 * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r
        if (!api.isOverWater(x, z)) continue
        const th = api.terrainHeight(x, z)
        if (th < deepest.d) deepest = { d: th, x, z }
      }
    }
    const wy = g.weather && g.weather.diveAudit ? null : null
    // force the capybara body deep under at the deepest spot found
    const b = g.capy.body
    const top = deepest.d  // terrainHeight IS the water surface height at a deep spot (negative = below datum? check)
    b.position.set(deepest.x, deepest.d - 6, deepest.z)
    b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    g.capy.diving = true
    // g.capy.depth is normally computed by capybara.js's own update from waterY - py;
    // fake it directly since we are bypassing that update loop
    Object.defineProperty(g.capy, 'depth', { value: 6, writable: true, configurable: true })
    const results = []
    for (let i = 0; i < 20 * 60; i++) {
      g.weather.update(1 / 60)
      if ((i + 1) % 30 === 0) {
        const a = g.weather.diveAudit()
        results.push({ t: +((i + 1) / 60).toFixed(2), alive: a.alive })
      }
    }
    return { deepest, results, finalAudit: g.weather.diveAudit() }
  }, CHAPTER)

  await page.evaluate(async (o) => { await fetch('/shot?name=dive-check-' + o.chapter + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
