async page => {
  // one chapter's real arrival frame (the composite), fresh boot, title-card key
  const KEY = 'Quote'  // edit per run: Digit1..Digit9, Digit0, Minus, Equal, BracketLeft, BracketRight, Semicolon, Quote, Comma, Period, Slash
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press(KEY)
  await page.waitForTimeout(9500)
  const b = await page.evaluate(() => window.__capy.biome.current)
  await page.screenshot({ path: 'qa/WOW-final-' + b + '.png' })
  return { biome: b, errs }
}
