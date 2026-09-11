async page => {
  await page.reload(); await page.waitForTimeout(4500)
  await page.keyboard.press('Digit1'); await page.waitForTimeout(4000)
  await page.evaluate(() => { const g = window.__capy; g.biome.switchTo('manly') }); await page.waitForTimeout(2500)
  await page.evaluate(() => { const g = window.__capy; const b = g.capy.body; b.position.set(0, 0.3, -24); b.velocity.set(0, 0, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position); g.manly.barrelDebug(true) })
  await page.waitForTimeout(1200)
  await page.evaluate(() => window.__capy.frameShot({ yaw: Math.PI * 0.5, dist: 10, pitch: 0.10, raise: 1.4, hold: 4 }))
  await page.waitForTimeout(1800)
  await page.screenshot({ path: 'qa/w1-manly-barrel-side.png' })
  await page.evaluate(() => window.__capy.frameShot({ yaw: Math.PI * 0.85, dist: 8, pitch: 0.16, raise: 1.2, hold: 4 }))
  await page.waitForTimeout(1800)
  await page.screenshot({ path: 'qa/w1-manly-barrel-back.png' })
  await page.evaluate(() => window.__capy.manly.barrelDebug(false))
}
