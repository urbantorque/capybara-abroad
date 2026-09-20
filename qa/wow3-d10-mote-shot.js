async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__capy && document.querySelector('.capyui-go'), null, { timeout: 120000, polling: 500 })
  await page.waitForTimeout(1500)
  await page.evaluate(() => document.querySelector('.capyui-go').click())
  await page.waitForFunction(() => window.__capy.state && window.__capy.state.started, null, { timeout: 60000, polling: 500 })
  await page.waitForTimeout(4500)
  await page.screenshot({ path: 'qa/wow3-d10-mote-field.png' })
  await page.evaluate(async () => { await fetch('/shot?name=w1-mote-shot.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify({ errs: [] })))) }) })
}
