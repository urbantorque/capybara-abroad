async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.setViewportSize({ width: 1280, height: 760 })
  const out = { errs: [] }
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5000)
  await page.keyboard.press('Period')
  await page.waitForTimeout(9000)
  out.before = await page.evaluate(() => window.__capy.monaco.race())
  await page.evaluate(() => window.__capy.monaco.raceDebug({ take: true }))
  await page.waitForTimeout(1500)
  out.grid = await page.evaluate(() => window.__capy.monaco.race())
  await page.screenshot({ path: 'qa/l3-defects-monaco.png' })
  await page.waitForTimeout(3000)
  out.go = await page.evaluate(() => window.__capy.monaco.race())
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5000)
  await page.keyboard.press('Digit7')
  await page.waitForTimeout(9000)
  await page.screenshot({ path: 'qa/l3-defects-iceland.png', clip: { x: 1090, y: 570, width: 190, height: 190 } })
  out.iceland = await page.evaluate(() => { const g = window.__capy; return { biome: g.biome.current, err: g.state.lastError || null } })
  out.errs = errs.slice(0, 40)
  await page.evaluate((o) => fetch('/shot?name=l3-defects.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}), out)
}
