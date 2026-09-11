async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.setViewportSize({ width: 1280, height: 760 })
  const out = { rows: [], errs: [] }
  const KEYS = ['Digit8', 'Period', 'Slash']
  for (const key of KEYS) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5000)
    await page.keyboard.press(key)
    await page.waitForTimeout(9000)
    await page.keyboard.down('KeyW'); await page.waitForTimeout(1200); await page.keyboard.up('KeyW')
    await page.waitForTimeout(300)
    const info = await page.evaluate(() => {
      const g = window.__capy
      return { biome: g.biome.current, started: !!g.state.started, err: g.state.lastError || null }
    })
    out.rows.push(Object.assign({ key: key }, info))
  }
  out.errs = errs.slice(0, 40)
  await page.evaluate((o) => fetch('/shot?name=l3-smoke3.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}), out)
}
