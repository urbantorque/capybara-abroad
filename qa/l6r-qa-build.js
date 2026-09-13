async page => {
  const errors = []
  page.on('pageerror', e => errors.push('pageerror: ' + String(e && e.message || e).slice(0, 200)))
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)) })
  const t0 = Date.now()
  await page.goto('file:///C:/Users/roger/OneDrive/Desktop/capy3/dist/untitled-capybara-game.html')
  await page.waitForTimeout(7000)
  const boot = await page.evaluate(() => {
    const g = window.__capy
    return { has: !!g, running: !!window.__capyRunning, failed: !!window.__capyFailed, soft: window.__capySoftGL || null,
      started: !!(g && g.state.started), url: location.protocol, err: (document.getElementById('err') || {}).textContent || '' }
  })
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  const tBegin = Date.now()
  let tStarted = -1
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(250)
    const s = await page.evaluate(() => !!(window.__capy && window.__capy.state.started))
    if (s) { tStarted = Date.now() - tBegin; break }
  }
  await page.waitForTimeout(4000)
  const after = await page.evaluate(() => {
    const g = window.__capy
    return { started: g.state.started, biome: g.biome.current, lastError: g.state.lastError || null,
      ks: g.musAudit ? g.musAudit().ks : 'n/a', mus: g.musAudit ? g.musAudit() : null }
  })
  await page.evaluate(() => window.__capy.hud.cross('venice'))
  await page.waitForTimeout(10000)
  const crossed = await page.evaluate(() => {
    const g = window.__capy
    const p = g.capy.position
    return { biome: g.biome.current, started: g.state.started, lastError: g.state.lastError || null,
      pos: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)], calls: g.state.perf.calls, tris: g.state.perf.triangles,
      err: (document.getElementById('err') || {}).textContent || '' }
  })
  await page.screenshot({ path: 'qa/l6r-qa-build-venice.png' })
  const out = { boot, tStarted, after, crossed, errors: errors.slice(0, 20), errorsN: errors.length, wallToBeginMs: tBegin - t0 }
  await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(3000)
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l6r-qa-build.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
