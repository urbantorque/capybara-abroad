async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.setViewportSize({ width: 1280, height: 760 })
  const out = { rows: [], errs: [] }
  const KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0',
    'Minus', 'Equal', 'BracketLeft', 'BracketRight', 'Semicolon', 'Quote', 'Comma', 'Period', 'Slash']
  for (const key of KEYS) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(4800)
    await page.keyboard.press(key)
    await page.waitForTimeout(9000)
    const info = await page.evaluate(() => {
      const g = window.__capy
      return { biome: g.biome.current, started: !!g.state.started, err: g.state.lastError || null }
    })
    await page.screenshot({ path: 'qa/l3-' + info.biome + '.png' })
    out.rows.push(Object.assign({ key: key }, info))
  }
  out.errs = errs.slice(0, 40)
  await page.evaluate((o) => fetch('/shot?name=l3-rest.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}), out)
}
