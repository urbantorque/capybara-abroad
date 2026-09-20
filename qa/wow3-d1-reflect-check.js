async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  const CHAPTER = 'kyoto'
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

  out.reflAfterArrival = await page.evaluate(() => window.__capy.reflectInfo())

  out.result = await page.evaluate(() => {
    const g = window.__capy
    if (!g.post || !g.post.enabled) return { skipped: 'post disabled' }
    const wasSub = g.post.params.sub
    const wasNoSub2 = !!g.state.noSub2
    g.state.noSub2 = false
    g.post.params.sub = 0.7
    g.post.render()
    const infoAfterForce = g.reflectInfo()
    g.post.params.sub = wasSub
    g.state.noSub2 = wasNoSub2
    g.post.render()
    return { infoAfterForce }
  })

  await page.screenshot({ path: 'qa/_w1-reflect-ceil-normal.png' })

  // Now force the ceiling shader path to STAY on for the screenshot itself.
  out.result2 = await page.evaluate(() => {
    const g = window.__capy
    g.state.noSub2 = false
    g.post.params.sub = 0.7
    g.post.render()
    return { renderedOnce: true }
  })
  await page.screenshot({ path: 'qa/_w1-reflect-ceil-forced.png' })
  await page.evaluate(() => { window.__capy.post.render() })

  await page.evaluate(async (o) => { await fetch('/shot?name=w1-reflect-ceil-check.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
