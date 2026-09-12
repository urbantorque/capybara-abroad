async page => {
  await page.setViewportSize({ width: 1280, height: 760 })
  const out = { rows: [] }
  for (const key of ['Digit0', 'Digit4', 'Minus']) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5000)
    await page.keyboard.press(key)
    await page.waitForTimeout(9000)
    const b = await page.evaluate(() => window.__capy.biome.current)
    await page.screenshot({ path: 'qa/l3-wide-' + b + '-on.png' })
    await page.evaluate(() => { window.__capy.state.noCrease = true })
    await page.waitForTimeout(300)
    await page.screenshot({ path: 'qa/l3-wide-' + b + '-off.png' })
    await page.evaluate(() => { window.__capy.state.noCrease = false })
    out.rows.push({ b, err: await page.evaluate(() => window.__capy.state.lastError || null) })
  }
  await page.evaluate((o) => fetch('/shot?name=l3-wide.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}), out)
}
