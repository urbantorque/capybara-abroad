async page => {
  await page.setViewportSize({ width: 1280, height: 720 })
  const keys = { venice: 'Digit0', kowloon: 'Minus', iceland: 'Digit7', rio: 'Digit6', kyoto: 'Digit4', cali: 'Digit5', manly: 'BracketRight', pantanal: 'Semicolon' }
  for (const [n, k] of Object.entries(keys)) {
    await page.reload()
    await page.waitForTimeout(4500)
    await page.keyboard.press(k)
    await page.waitForTimeout(3000)
    await page.keyboard.down('w')
    await page.waitForTimeout(1800)
    await page.keyboard.up('w')
    await page.waitForTimeout(1500)
    const buf = await page.screenshot()
    await page.evaluate(async (a) => { await fetch('/shot?name=w-' + a.n, { method: 'POST', body: 'data:image/png;base64,' + a.d }) }, { d: buf.toString('base64'), n })
  }
}
