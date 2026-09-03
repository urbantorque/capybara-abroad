async page => {
  // THE FOUR FRAMES OF THE DOOR OPENING, at Sydney's ferry wharf — the one
  // exit in the game that is ungated and that a stranger reaches first.
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(8000)
  await page.evaluate(() => {
    const g = window.__capy
    g.capy.body.position.set(-40.2, 1.2, -19.6)
    g.capy.body.velocity.set(0, 0, 0)
  })
  await page.waitForTimeout(2800)
  await page.screenshot({ path: 'qa/d6o-1-at-the-door.png' })
  await page.keyboard.press('KeyQ'); await page.waitForTimeout(220)
  await page.keyboard.press('KeyQ'); await page.waitForTimeout(220)
  await page.keyboard.press('KeyQ')
  await page.waitForTimeout(780)
  await page.screenshot({ path: 'qa/d6o-2-the-camera-turns.png' })
  await page.waitForTimeout(220)
  await page.screenshot({ path: 'qa/d6o-3-the-card-grows.png' })
  await page.waitForTimeout(1400)
  await page.screenshot({ path: 'qa/d6o-4-open.png' })
}
