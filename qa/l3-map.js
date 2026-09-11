async page => {
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5000)
  await page.keyboard.press('Digit7')
  await page.waitForTimeout(9000)
  await page.screenshot({ path: 'qa/l3-defects-iceland.png', clip: { x: 1090, y: 570, width: 190, height: 190 } })
}
