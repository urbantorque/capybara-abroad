async page => {
  await page.evaluate(() => { try { localStorage.removeItem('capy3.journey.v1') } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.keyboard.press('Digit7')
  await page.waitForTimeout(4500)
  await page.evaluate(() => {
    const g = window.__capy
    ;['pylsa', 'organ', 'puffins', 'the-whale'].forEach(id => g.completeTask(id))
  })
  await page.waitForTimeout(3200)
  await page.screenshot({ path: 'qa/shot-actcard.png' })
  await page.evaluate(() => {
    const g = window.__capy
    ;['geysir', 'glacier-run', 'snowcat', 'hot-spring', 'aurora'].forEach(id => g.completeTask(id))
  })
  await page.waitForTimeout(4200)
  await page.screenshot({ path: 'qa/shot-keepcard.png' })
  return 'ok'
}
