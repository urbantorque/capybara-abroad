async page => {
  await page.reload()
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit4')
  await page.waitForTimeout(11000)
  await page.evaluate(() => {
    const g = window.__capy
    const b = g.capy.body
    b.position.set(-14, 1.2, 30); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
  })
  await page.waitForTimeout(2500)
  const b = await page.screenshot({ type: 'png' })
  await page.evaluate(async (a) => { await fetch('/shot?name=k-sando', { method: 'POST', body: a }) }, 'data:image/png;base64,' + b.toString('base64'))
}
