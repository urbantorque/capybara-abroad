async page => {
  await page.reload(); await page.waitForTimeout(4500)
  await page.keyboard.press('Digit1'); await page.waitForTimeout(4000)
  await page.evaluate(() => { const g = window.__capy; g.biome.switchTo('cali') }); await page.waitForTimeout(2500)
  await page.evaluate(() => { const g = window.__capy; const b = g.capy.body; b.position.set(-84, 18.5, -46); b.velocity.set(0, 0, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) })
  await page.waitForTimeout(1500)
  await page.evaluate(() => { const g = window.__capy; g.cali.fireworksDebug(); g.frameShot({ yaw: Math.PI * 1.5, dist: 9, pitch: 0.04, raise: 2.0, hold: 5 }) })
  await page.waitForTimeout(3200)
  await page.screenshot({ path: 'qa/w1-cali-fireworks.png' })
}
